package main

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"os"
	"strings"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

var hub = NewHub()

func handleWS(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		slog.Error("websocket upgrade failed", "error", err)
		return
	}

	_, raw, err := conn.ReadMessage()
	if err != nil {
		slog.Error("first message read failed", "error", err)
		conn.WriteMessage(websocket.TextMessage, errorMsg("failed to read first message"))
		conn.Close()
		return
	}
	slog.Debug("first message received", "raw", string(raw))

	var msg struct {
		Type string `json:"type"`
	}
	if err := json.Unmarshal(raw, &msg); err != nil {
		conn.WriteMessage(websocket.TextMessage, errorMsg("invalid json"))
		conn.Close()
		return
	}

	switch msg.Type {
	case "create_room":
		handleCreateRoom(conn, raw)
	case "join_room":
		handleJoinRoom(conn, raw)
	case "reconnect":
		handleReconnect(conn, raw)
	default:
		conn.WriteMessage(websocket.TextMessage, errorMsg("expected create_room, join_room, or reconnect as first message"))
		conn.Close()
	}
}

func handleCreateRoom(conn *websocket.Conn, raw []byte) {
	var m struct {
		Name         string `json:"name"`
		NightSeconds int    `json:"nightSeconds"`
		DaySeconds   int    `json:"daySeconds"`
		VoteSeconds  int    `json:"voteSeconds"`
	}
	if err := json.Unmarshal(raw, &m); err != nil {
		conn.WriteMessage(websocket.TextMessage, errorMsg("invalid json"))
		conn.Close()
		return
	}
	name := strings.TrimSpace(m.Name)
	if name == "" || len(name) > NameMaxLength {
		conn.WriteMessage(websocket.TextMessage, errorMsg("invalid name"))
		conn.Close()
		return
	}

	config := RoomConfig{
		NightSeconds: clampPhase(m.NightSeconds, DefaultNightSeconds),
		DaySeconds:   clampPhase(m.DaySeconds, DefaultDaySeconds),
		VoteSeconds:  clampPhase(m.VoteSeconds, DefaultVoteSeconds),
	}

	room, _ := hub.CreateRoom(config)
	sendCh := make(chan []byte, 64)
	resultCh := make(chan string, 1)

	room.Intents <- Intent{
		Type:   IntentJoin,
		Conn:   conn,
		Send:   sendCh,
		Name:   name,
		Result: resultCh,
	}

	playerID := <-resultCh
	if playerID == "" {
		conn.Close()
		return
	}

	spawnReadWrite(conn, sendCh, room, playerID)
}

func handleJoinRoom(conn *websocket.Conn, raw []byte) {
	slog.Debug("join request received")
	var m struct {
		Code string `json:"code"`
		Name string `json:"name"`
	}
	if err := json.Unmarshal(raw, &m); err != nil {
		slog.Error("join request unmarshal failed", "error", err)
		conn.WriteMessage(websocket.TextMessage, errorMsg("invalid json"))
		conn.Close()
		return
	}
	code := strings.ToUpper(strings.TrimSpace(m.Code))
	name := strings.TrimSpace(m.Name)
	slog.Debug("join room params", "code", code, "name", name)
	if len(code) != RoomCodeLength {
		conn.WriteMessage(websocket.TextMessage, errorMsg("invalid room code"))
		conn.Close()
		return
	}
	if name == "" || len(name) > NameMaxLength {
		conn.WriteMessage(websocket.TextMessage, errorMsg("invalid name"))
		conn.Close()
		return
	}

	room, ok := hub.LookupRoom(code)
	if !ok {
		slog.Warn("room not found", "code", code)
		conn.WriteMessage(websocket.TextMessage, errorMsg("room not found"))
		conn.Close()
		return
	}
	slog.Debug("sending join intent", "code", code)

	sendCh := make(chan []byte, 64)
	resultCh := make(chan string, 1)

	room.Intents <- Intent{
		Type:   IntentJoin,
		Conn:   conn,
		Send:   sendCh,
		Name:   name,
		Result: resultCh,
	}

	playerID := <-resultCh
	slog.Debug("join result received", "playerID", playerID, "code", code)
	if playerID == "" {
		conn.Close()
		return
	}

	spawnReadWrite(conn, sendCh, room, playerID)
}

func handleReconnect(conn *websocket.Conn, raw []byte) {
	var m struct {
		Token string `json:"token"`
	}
	if err := json.Unmarshal(raw, &m); err != nil {
		conn.WriteMessage(websocket.TextMessage, errorMsg("invalid json"))
		conn.Close()
		return
	}
	if m.Token == "" {
		conn.WriteMessage(websocket.TextMessage, errorMsg("missing token"))
		conn.Close()
		return
	}

	room, ok := hub.LookupRoomByToken(m.Token)
	if !ok {
		conn.WriteMessage(websocket.TextMessage, errorMsg("session expired"))
		conn.Close()
		return
	}

	sendCh := make(chan []byte, 64)
	resultCh := make(chan string, 1)

	room.Intents <- Intent{
		Type:   IntentReconnect,
		Token:  m.Token,
		Conn:   conn,
		Send:   sendCh,
		Result: resultCh,
	}

	playerID := <-resultCh
	if playerID == "" {
		conn.Close()
		return
	}

	spawnReadWrite(conn, sendCh, room, playerID)
}

func spawnReadWrite(conn *websocket.Conn, sendCh chan []byte, room *Room, playerID string) {
	go func() {
		defer conn.Close()
		for msg := range sendCh {
			if err := conn.WriteMessage(websocket.TextMessage, msg); err != nil {
				break
			}
		}
	}()

	go func() {
		defer func() {
			room.Intents <- Intent{
				PlayerID: playerID,
				Type:     IntentDisconnect,
			}
			conn.Close()
		}()
		for {
			_, raw, err := conn.ReadMessage()
			if err != nil {
				return
			}
			var msg struct {
				Type string `json:"type"`
			}
			if err := json.Unmarshal(raw, &msg); err != nil {
				continue
			}

			switch msg.Type {
			case "start_game":
				room.Intents <- Intent{PlayerID: playerID, Type: IntentStartGame}
			case "night_kill":
				room.Intents <- Intent{PlayerID: playerID, Type: IntentNightKill, Payload: raw}
			case "investigate":
				room.Intents <- Intent{PlayerID: playerID, Type: IntentDetectiveInvestigate, Payload: raw}
			case "protect":
				room.Intents <- Intent{PlayerID: playerID, Type: IntentDoctorProtect, Payload: raw}
			case "chat":
				room.Intents <- Intent{PlayerID: playerID, Type: IntentChat, Payload: raw}
			case "vote":
				room.Intents <- Intent{PlayerID: playerID, Type: IntentVote, Payload: raw}
			default:
			}
		}
	}()
}

func clampPhase(val, def int) int {
	if val < MinPhaseSeconds || val > MaxPhaseSeconds {
		return def
	}
	return val
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "3000" // fallback for local dev
	}

	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo})))

	http.HandleFunc("/ws", handleWS)
	slog.Info("server starting", "port", port)
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		slog.Error("server failed", "error", err)
		os.Exit(1)
	}
}
