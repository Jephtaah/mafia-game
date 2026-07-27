package main

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"log/slog"
	"math/big"
	"strings"
	"time"

	"github.com/gorilla/websocket"
)

type IntentType string

const (
	IntentJoin              IntentType = "join"
	IntentStartGame         IntentType = "start_game"
	IntentNightKill         IntentType = "night_kill"
	IntentChat              IntentType = "chat"
	IntentVote              IntentType = "vote"
	IntentReconnect         IntentType = "reconnect"
	IntentDisconnect        IntentType = "disconnect"
	IntentDetectiveInvestigate IntentType = "investigate"
	IntentDoctorProtect     IntentType = "protect"
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

type NightState struct {
	Targets         map[string]string // impostorID -> targetID
	DetectiveTarget string            // playerID under investigation
	DoctorTarget    string            // playerID being protected
	DoctorPlayer    string            // doctor playerID (for sending result)
	DetectivePlayer string            // detective playerID (for sending result)
}

type VoteState struct {
	Votes map[string]string // voterID -> targetID or "skip"
}

type Room struct {
	Code      string
	Players   []*Player
	Phase     string
	HostID    string
	Config    RoomConfig
	CreatedAt time.Time

	Intents chan Intent

	phaseTimer     *time.Timer
	roomEmptySince *time.Time
	nightState     *NightState
	nightResult    *nightResolution // cached result from night→resolution transition
	voteState      *VoteState
	endedAt        time.Time

	EliminatedPlayers []string // IDs of eliminated players, in order

	done      chan struct{}
	onTeardown      func(code string)
	onTokenRegister func(token, code string)
}

type nightResolution struct {
	eliminatedID string
	role         string
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
			r.handlePhaseTimerExpiry()
		case <-ticker.C:
			r.handleHousekeeping()
		case <-r.done:
			return
		}
	}
}

func (r *Room) handleIntent(in Intent) {
	switch in.Type {
	case IntentJoin:
		r.handleJoin(in)
	case IntentStartGame:
		r.handleStartGame(in)
	case IntentNightKill:
		r.handleNightKill(in)
	case IntentDetectiveInvestigate:
		r.handleInvestigate(in)
	case IntentDoctorProtect:
		r.handleProtect(in)
	case IntentChat:
		r.handleChat(in)
	case IntentVote:
		r.handleVote(in)
	case IntentReconnect:
		r.handleReconnect(in)
	case IntentDisconnect:
		r.handleDisconnect(in)
	}
}

func (r *Room) handleDisconnect(in Intent) {
	p := r.findPlayer(in.PlayerID)
	if p == nil || !p.Connected {
		return
	}
	if r.Phase == "lobby" {
		close(p.Send)
		r.removePlayer(p.ID)
		r.broadcastAll(playerListMsg(r))
		return
	}
	// Mid-game: preserve seat and role, mark disconnected
	p.Connected = false
	p.DisconnectedAt = time.Now()
	close(p.Send)
	r.broadcastAll(playerDisconnectedMsg(p.ID))
	r.broadcastAll(playerListMsg(r))
	if r.allDisconnected() {
		now := time.Now()
		r.roomEmptySince = &now
	}
}

func (r *Room) handleReconnect(in Intent) {
	p := r.findPlayerByToken(in.Token)
	if p == nil {
		r.sendToPlayer(in.Send, errorMsg("session expired"))
		close(in.Send)
		if in.Result != nil {
			in.Result <- ""
		}
		return
	}
	if p.Connected {
		// Previous connection is still alive — close it and take over
		p.Conn.Close()
		close(p.Send)
	}
	p.Conn = in.Conn
	p.Send = in.Send
	p.Connected = true
	p.DisconnectedAt = time.Time{}
	r.roomEmptySince = nil
	r.sendTo(p, resumeStateMsg(r, p))
	r.broadcastAll(playerReconnectedMsg(p.ID))
	r.broadcastAll(playerListMsg(r))
	if in.Result != nil {
		in.Result <- p.ID
	}
}

func (r *Room) allDisconnected() bool {
	for _, p := range r.Players {
		if p.Connected {
			return false
		}
	}
	return true
}

func (r *Room) removePlayer(id string) {
	idx := -1
	for i, p := range r.Players {
		if p.ID == id {
			idx = i
			break
		}
	}
	if idx == -1 {
		return
	}
	r.Players = append(r.Players[:idx], r.Players[idx+1:]...)
	if r.HostID == id && len(r.Players) > 0 {
		r.Players[0].IsHost = true
		r.HostID = r.Players[0].ID
	}
}

func (r *Room) handleJoin(in Intent) {
	slog.Info("player joining", "phase", r.Phase, "name", in.Name, "room", r.Code)
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
		IsAlive:   true,
	}
	if p.IsHost {
		r.HostID = p.ID
	}
	r.Players = append(r.Players, p)
	if r.onTokenRegister != nil {
		r.onTokenRegister(p.Token, r.Code)
	}
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
		r.sendTo(pl, buildRoleReveal(pl, r.Players, r.Config.NightSeconds))
	}
	r.broadcastAll(playerListMsg(r))
	r.startPhase("night", r.Config.NightSeconds)
}

func (r *Room) handleNightKill(in Intent) {
	p := r.findPlayer(in.PlayerID)
	if r.Phase != "night" || p == nil || !p.IsAlive || p.Role != "impostor" {
		return
	}
	var payload struct {
		Target string `json:"target"`
	}
	if err := json.Unmarshal(in.Payload, &payload); err != nil {
		return
	}
	target := r.findPlayer(payload.Target)
	if target == nil || !target.IsAlive || target.ID == p.ID {
		return
	}
	if r.nightState == nil {
		r.nightState = &NightState{Targets: make(map[string]string)}
	}
	r.nightState.Targets[p.ID] = target.ID
	r.broadcastToImpostors(nightStatusMsg(r.nightState, r.Players))
}

func (r *Room) handleInvestigate(in Intent) {
	p := r.findPlayer(in.PlayerID)
	if r.Phase != "night" || p == nil || !p.IsAlive || p.Role != "detective" {
		return
	}
	var payload struct {
		Target string `json:"target"`
	}
	if err := json.Unmarshal(in.Payload, &payload); err != nil {
		return
	}
	target := r.findPlayer(payload.Target)
	if target == nil || !target.IsAlive || target.ID == p.ID {
		return
	}
	if r.nightState == nil {
		r.nightState = &NightState{}
	}
	r.nightState.DetectiveTarget = target.ID
	r.nightState.DetectivePlayer = p.ID
}

func (r *Room) handleProtect(in Intent) {
	p := r.findPlayer(in.PlayerID)
	if r.Phase != "night" || p == nil || !p.IsAlive || p.Role != "doctor" {
		return
	}
	var payload struct {
		Target string `json:"target"`
	}
	if err := json.Unmarshal(in.Payload, &payload); err != nil {
		return
	}
	target := r.findPlayer(payload.Target)
	if target == nil || !target.IsAlive {
		return
	}
	if r.nightState == nil {
		r.nightState = &NightState{}
	}
	r.nightState.DoctorTarget = target.ID
	r.nightState.DoctorPlayer = p.ID
}

func (r *Room) handleChat(in Intent) {
	p := r.findPlayer(in.PlayerID)
	if r.Phase != "day" || p == nil || !p.IsAlive {
		return
	}
	var payload struct {
		Text string `json:"text"`
	}
	if err := json.Unmarshal(in.Payload, &payload); err != nil {
		return
	}
	text := strings.TrimSpace(payload.Text)
	if text == "" || len(text) > ChatMaxLength {
		return
	}
	r.broadcastAll(chatMessage(p, text))
}

func (r *Room) handleVote(in Intent) {
	p := r.findPlayer(in.PlayerID)
	if r.Phase != "voting" || p == nil || !p.IsAlive {
		return
	}
	var payload struct {
		Target string `json:"target"`
	}
	if err := json.Unmarshal(in.Payload, &payload); err != nil {
		return
	}
	if r.voteState == nil {
		r.voteState = &VoteState{Votes: make(map[string]string)}
	}
	r.voteState.Votes[p.ID] = payload.Target
	r.broadcastAll(voteTallyMsg(r.voteState, r.Players))
}

func (r *Room) handlePhaseTimerExpiry() {
	switch r.Phase {
	case "night":
		r.resolveNight()
	case "resolution":
		if r.nightResult != nil {
			if r.nightResult.eliminatedID != "" {
				target := r.findPlayer(r.nightResult.eliminatedID)
				if target != nil {
					target.IsAlive = false
					r.EliminatedPlayers = append(r.EliminatedPlayers, r.nightResult.eliminatedID)
				}
				r.broadcastAll(playerListMsg(r))
			}
			r.nightResult = nil
			winner := r.checkWin()
			if winner != "" {
				r.endGame(winner)
				return
			}
		}
		r.startPhase("day", r.Config.DaySeconds)
	case "day":
		r.voteState = &VoteState{Votes: make(map[string]string)}
		r.startPhase("voting", r.Config.VoteSeconds)
	case "voting":
		r.resolveVoting()
	}
}

func (r *Room) resolveNight() {
	r.phaseTimer = nil
	var elimID, elimRole string
	if r.nightState != nil && len(r.nightState.Targets) > 0 {
		counts := make(map[string]int)
		for _, targetID := range r.nightState.Targets {
			counts[targetID]++
		}
		impostorCount := 0
		for _, p := range r.Players {
			if p.Role == "impostor" {
				impostorCount++
			}
		}
		for targetID, count := range counts {
			majorityRequired := impostorCount / 2 + 1
			if impostorCount == 1 {
				majorityRequired = 1
			}
			if count >= majorityRequired {
				// Doctor save check: if doctor protected this target, cancel the kill
				if r.nightState.DoctorTarget == targetID {
					elimID = ""
					elimRole = ""
				} else {
					target := r.findPlayer(targetID)
					if target != nil {
						elimID = targetID
						elimRole = target.Role
					}
				}
				break
			}
		}
	}

	// Send investigation result to detective
	if r.nightState != nil && r.nightState.DetectiveTarget != "" {
		target := r.findPlayer(r.nightState.DetectiveTarget)
		if target != nil {
			detective := r.findPlayer(r.nightState.DetectivePlayer)
			if detective != nil {
				r.sendTo(detective, investigationResultMsg(target.ID, target.Role == "impostor"))
			}
		}
	}

	r.nightState = nil
	r.nightResult = &nightResolution{eliminatedID: elimID, role: elimRole}
	r.broadcastAll(resolutionMsg(elimID, elimRole))
	r.startPhase("resolution", ResolutionDelay)
}

func (r *Room) resolveVoting() {
	r.phaseTimer = nil
	var elimID, elimRole string
	if r.voteState != nil && len(r.voteState.Votes) > 0 {
		counts := make(map[string]int)
		for _, target := range r.voteState.Votes {
			counts[target]++
		}
		maxCount := 0
		for _, c := range counts {
			if c > maxCount {
				maxCount = c
			}
		}
		candidates := make([]string, 0)
		for target, c := range counts {
			if c == maxCount {
				candidates = append(candidates, target)
			}
		}
		if len(candidates) == 1 && candidates[0] != "skip" {
			target := r.findPlayer(candidates[0])
			if target != nil {
				elimID = candidates[0]
				elimRole = target.Role
			}
		}
	}
	r.voteState = nil
	if elimID != "" {
		target := r.findPlayer(elimID)
		if target != nil {
			target.IsAlive = false
			r.EliminatedPlayers = append(r.EliminatedPlayers, elimID)
		}
		r.broadcastAll(eliminationMsg(elimID, elimRole))
		r.broadcastAll(playerListMsg(r))
	} else {
		r.broadcastAll(eliminationMsg("", ""))
	}
	winner := r.checkWin()
	if winner != "" {
		r.endGame(winner)
		return
	}
	r.nightState = nil
	r.startPhase("night", r.Config.NightSeconds)
}

func (r *Room) assignRoles() {
	n := len(r.Players)
	impostorCount := ImpostorCounts[n]
	// Detective for 6+, doctor for 7+
	hasDetective := n >= 6
	hasDoctor := n >= 7
	shuffled := shuffle(r.Players)
	idx := 0
	for i := 0; i < impostorCount; i++ {
		shuffled[idx].Role = "impostor"
		shuffled[idx].IsAlive = true
		idx++
	}
	if hasDetective {
		shuffled[idx].Role = "detective"
		shuffled[idx].IsAlive = true
		idx++
	}
	if hasDoctor {
		shuffled[idx].Role = "doctor"
		shuffled[idx].IsAlive = true
		idx++
	}
	for ; idx < n; idx++ {
		shuffled[idx].Role = "crewmate"
		shuffled[idx].IsAlive = true
	}
}

func (r *Room) startPhase(phase string, seconds int) {
	r.Phase = phase
	r.phaseTimer = time.NewTimer(time.Duration(seconds) * time.Second)
	r.broadcastAll(phaseChangeMsg(phase, seconds))
}

func (r *Room) handleHousekeeping() {
	now := time.Now()

	// Step 6.3: Grace-period eviction — disconnected players become dead after grace window
	if r.Phase != "lobby" && r.Phase != "ended" && r.Phase != "" {
		for _, p := range r.Players {
			if !p.Connected && !p.DisconnectedAt.IsZero() &&
				now.Sub(p.DisconnectedAt) > ReconnectGraceSeconds*time.Second {
				p.IsAlive = false
				r.EliminatedPlayers = append(r.EliminatedPlayers, p.ID)
				r.broadcastAll(eliminationMsg(p.ID, p.Role))
				r.broadcastAll(playerListMsg(r))
				winner := r.checkWin()
				if winner != "" {
					r.endGame(winner)
					return
				}
			}
		}
	}

	// Step 6.4: Full-room-disconnect teardown
	r.checkRoomEmptyTeardown(now)

	// Step 6.5: Abandoned-lobby cleanup by age
	r.checkLobbyAbandon(now)

	// End-of-game cleanup: 30 seconds after game over, tear down
	if r.Phase == "ended" && !r.endedAt.IsZero() && now.Sub(r.endedAt) > 30*time.Second {
		r.teardown()
	}
}

func (r *Room) checkRoomEmptyTeardown(now time.Time) {
	if r.roomEmptySince == nil {
		return
	}
	if now.Sub(*r.roomEmptySince) > RoomEmptyGraceSeconds*time.Second {
		r.teardown()
	}
}

func (r *Room) checkLobbyAbandon(now time.Time) {
	if r.Phase == "lobby" && now.Sub(r.CreatedAt) > LobbyAbandonMinutes*time.Minute {
		r.teardown()
	}
}

func (r *Room) teardown() {
	if r.onTeardown != nil {
		r.onTeardown(r.Code)
	}
	close(r.done)
}

func (r *Room) sendToPlayer(ch chan []byte, msg []byte) {
	select {
	case ch <- msg:
	default:
	}
}

func (r *Room) sendTo(p *Player, msg []byte) {
	if p == nil || !p.Connected || p.Send == nil {
		return
	}
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

func (r *Room) broadcastToImpostors(msg []byte) {
	for _, p := range r.Players {
		if p.Role == "impostor" {
			r.sendTo(p, msg)
		}
	}
}

func (r *Room) checkWin() string {
	aliveImpostors, aliveCrew := 0, 0
	for _, p := range r.Players {
		if p.IsAlive {
			if p.Role == "impostor" {
				aliveImpostors++
			} else {
				aliveCrew++
			}
		}
	}
	if aliveImpostors >= aliveCrew {
		return "impostors"
	}
	if aliveImpostors == 0 {
		return "crewmates"
	}
	return ""
}

func (r *Room) endGame(winner string) {
	r.Phase = "ended"
	r.phaseTimer = nil
	r.endedAt = time.Now()
	r.broadcastAll(gameOverMsg(r, winner))
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

func buildRoleReveal(p *Player, players []*Player, nightSeconds int) []byte {
	var desc string
	switch p.Role {
	case "impostor":
		desc = "Eliminate crewmates without being caught."
	case "detective":
		desc = "Investigate one player each night to find impostors."
	case "doctor":
		desc = "Protect one player each night from elimination."
	default:
		desc = "Complete tasks and find the impostors."
	}
	m := map[string]interface{}{
		"type":    "role_reveal",
		"role":    p.Role,
		"desc":    desc,
		"timer":   nightSeconds,
		"players": buildPlayerList(players),
	}
	if p.Role == "impostor" {
		m["fellowImpostors"] = buildFellowImpostors(players, p.ID)
	}
	return safeMarshal(m)
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


