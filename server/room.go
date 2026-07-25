package main

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"log"
	"math/big"
	"time"

	"github.com/gorilla/websocket"
)

type IntentType string

const (
	IntentJoin       IntentType = "join"
	IntentStartGame  IntentType = "start_game"
	IntentNightKill  IntentType = "night_kill"
	IntentChat       IntentType = "chat"
	IntentVote       IntentType = "vote"
	IntentReconnect  IntentType = "reconnect"
	IntentDisconnect IntentType = "disconnect"
)

type Intent struct {
	PlayerID string
	Type     IntentType
	Payload  json.RawMessage
	Conn     *websocket.Conn
	Send     chan []byte
	Name     string
	Token    string
	Result   chan string // for join: returns the assigned player ID
}

type Player struct {
	ID             string
	Name           string
	Conn           *websocket.Conn
	Send           chan []byte
	Token          string
	IsHost         bool
	IsAlive        bool
	Connected      bool
	DisconnectedAt time.Time
	Role           string
}

type RoomConfig struct {
	NightSeconds int
	DaySeconds   int
	VoteSeconds  int
}

type Room struct {
	Code    string
	Players []*Player
	Phase   string
	HostID  string
	Config  RoomConfig
	CreatedAt time.Time

	Intents chan Intent

	phaseTimer     *time.Timer
	roomEmptySince *time.Time

	onTeardown func(code string)
}

func (r *Room) Run() {
	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()
	for {
		var timerC <-chan time.Time
		if r.phaseTimer != nil {
			timerC = r.phaseTimer.C
		}
		select {
		case intent, ok := <-r.Intents:
			if !ok {
				return
			}
			r.handleIntent(intent)
		case <-timerC:
			r.phaseTimer = nil
		case <-ticker.C:
			r.handleHousekeeping()
		}
	}
}

func (r *Room) handleIntent(in Intent) {
	switch in.Type {
	case IntentJoin:
		r.handleJoin(in)
	case IntentStartGame:
		r.handleStartGame(in)
	}
}

func (r *Room) handleJoin(in Intent) {
	log.Printf("handleJoin: phase=%q, name=%q", r.Phase, in.Name)
	if r.Phase != "lobby" {
		r.sendToPlayer(in.Send, errorMsg("game already in progress"))
		close(in.Send)
		if in.Result != nil {
			in.Result <- ""
		}
		return
	}
	if len(r.Players) >= MaxPlayers {
		r.sendToPlayer(in.Send, errorMsg("room is full"))
		close(in.Send)
		if in.Result != nil {
			in.Result <- ""
		}
		return
	}
	p := &Player{
		ID:        newID(),
		Name:      in.Name,
		Conn:      in.Conn,
		Send:      in.Send,
		Token:     newToken(),
		IsHost:    len(r.Players) == 0,
		Connected: true,
	}
	if p.IsHost {
		r.HostID = p.ID
	}
	r.Players = append(r.Players, p)
	r.sendToPlayer(p.Send, roomCreatedMsg(r, p))
	r.broadcastAll(playerListMsg(r))
	if in.Result != nil {
		in.Result <- p.ID
	}
}

func (r *Room) handleStartGame(in Intent) {
	p := r.findPlayer(in.PlayerID)
	if p == nil || p.ID != r.HostID {
		if p != nil {
			r.sendTo(p, errorMsg("only the host can start the game"))
		}
		return
	}
	if len(r.Players) < MinPlayers {
		r.sendTo(p, errorMsg("need at least 5 players"))
		return
	}
	r.assignRoles()
	for _, pl := range r.Players {
		r.sendTo(pl, buildRoleReveal(pl, r.Players))
	}
	r.startPhase("night", r.Config.NightSeconds)
}

func (r *Room) assignRoles() {
	count := ImpostorCounts[len(r.Players)]
	shuffled := shuffle(r.Players)
	for i, p := range shuffled {
		if i < count {
			p.Role = "impostor"
		} else {
			p.Role = "crewmate"
		}
		p.IsAlive = true
	}
}

func (r *Room) startPhase(phase string, seconds int) {
	r.Phase = phase
	r.phaseTimer = time.NewTimer(time.Duration(seconds) * time.Second)
	r.broadcastAll(phaseChangeMsg(phase, seconds))
}

func (r *Room) handleHousekeeping() {
}

func (r *Room) sendToPlayer(ch chan []byte, msg []byte) {
	select {
	case ch <- msg:
	default:
	}
}

func (r *Room) sendTo(p *Player, msg []byte) {
	select {
	case p.Send <- msg:
	default:
	}
}

func (r *Room) broadcastAll(msg []byte) {
	for _, p := range r.Players {
		r.sendTo(p, msg)
	}
}

func (r *Room) findPlayer(id string) *Player {
	for _, p := range r.Players {
		if p.ID == id {
			return p
		}
	}
	return nil
}

func (r *Room) findPlayerByToken(token string) *Player {
	for _, p := range r.Players {
		if p.Token == token {
			return p
		}
	}
	return nil
}

func buildRoleReveal(p *Player, players []*Player) []byte {
	if p.Role == "impostor" {
		var fellows []PlayerInfo
		for _, pl := range players {
			if pl.Role == "impostor" && pl.ID != p.ID {
				fellows = append(fellows, PlayerInfo{ID: pl.ID, Name: pl.Name, IsHost: pl.IsHost, Connected: pl.Connected})
			}
		}
		b, _ := json.Marshal(map[string]interface{}{
			"type":            "role_reveal",
			"role":            "impostor",
			"fellowImpostors": fellows,
		})
		return b
	}
	b, _ := json.Marshal(map[string]interface{}{
		"type": "role_reveal",
		"role": "crewmate",
	})
	return b
}

func shuffle(players []*Player) []*Player {
	n := len(players)
	out := make([]*Player, n)
	copy(out, players)
	for i := n - 1; i > 0; i-- {
		jBig, _ := rand.Int(rand.Reader, big.NewInt(int64(i+1)))
		j := int(jBig.Int64())
		out[i], out[j] = out[j], out[i]
	}
	return out
}

func newID() string {
	b := make([]byte, 8)
	rand.Read(b)
	return hex.EncodeToString(b)
}

func newToken() string {
	b := make([]byte, 16)
	rand.Read(b)
	return hex.EncodeToString(b)
}


