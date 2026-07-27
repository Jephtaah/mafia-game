package main

import (
	"encoding/json"
	"log/slog"
)

type PlayerInfo struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	IsHost    bool   `json:"isHost"`
	IsAlive   bool   `json:"isAlive"`
	Connected bool   `json:"connected"`
}

func buildPlayerList(players []*Player) []PlayerInfo {
	out := make([]PlayerInfo, len(players))
	for i, p := range players {
		out[i] = PlayerInfo{ID: p.ID, Name: p.Name, IsHost: p.IsHost, IsAlive: p.IsAlive, Connected: p.Connected}
	}
	return out
}

func buildFellowImpostors(players []*Player, selfID string) []PlayerInfo {
	var out []PlayerInfo
	for _, p := range players {
		if p.Role == "impostor" && p.ID != selfID {
			out = append(out, PlayerInfo{ID: p.ID, Name: p.Name, IsHost: p.IsHost, IsAlive: p.IsAlive, Connected: p.Connected})
		}
	}
	return out
}

func safeMarshal(v interface{}) []byte {
	b, err := json.Marshal(v)
	if err != nil {
		slog.Error("json marshal failed", "error", err)
		return []byte(`{"type":"error","message":"internal server error"}`)
	}
	return b
}

func errorMsg(msg string) []byte {
	return safeMarshal(map[string]string{"type": "error", "message": msg})
}

func roomCreatedMsg(r *Room, p *Player) []byte {
	return safeMarshal(map[string]interface{}{
		"type":     "room_created",
		"code":     r.Code,
		"playerId": p.ID,
		"token":    p.Token,
		"players":  buildPlayerList(r.Players),
		"isHost":   p.IsHost,
	})
}

func playerListMsg(r *Room) []byte {
	return safeMarshal(map[string]interface{}{
		"type":    "player_list",
		"players": buildPlayerList(r.Players),
	})
}

func phaseChangeMsg(phase string, seconds int) []byte {
	return safeMarshal(map[string]interface{}{
		"type":  "phase_change",
		"phase": phase,
		"timer": seconds,
	})
}

func nightStatusMsg(ns *NightState, players []*Player) []byte {
	// Build list of impostor IDs who have voted (have a target)
	voted := make([]string, 0)
	impostorCount := 0
	for _, p := range players {
		if p.Role == "impostor" {
			impostorCount++
			if _, ok := ns.Targets[p.ID]; ok {
				voted = append(voted, p.ID)
			}
		}
	}
	waiting := len(voted) < impostorCount
	return safeMarshal(map[string]interface{}{
		"type":   "night_status",
		"voted":  voted,
		"waiting": waiting,
	})
}

func resolutionMsg(eliminatedID string, role string) []byte {
	var elimPtr *string
	var rolePtr *string
	if eliminatedID != "" {
		elimPtr = &eliminatedID
	}
	if role != "" {
		rolePtr = &role
	}
	return safeMarshal(map[string]interface{}{
		"type":       "resolution",
		"eliminated": elimPtr,
		"role":       rolePtr,
	})
}

func eliminationMsg(eliminatedID string, role string) []byte {
	var elimPtr *string
	var rolePtr *string
	if eliminatedID != "" {
		elimPtr = &eliminatedID
	}
	if role != "" {
		rolePtr = &role
	}
	return safeMarshal(map[string]interface{}{
		"type":       "elimination",
		"eliminated": elimPtr,
		"role":       rolePtr,
	})
}

func chatMessage(p *Player, text string) []byte {
	return safeMarshal(map[string]interface{}{
		"type":     "chat_message",
		"playerId": p.ID,
		"name":     p.Name,
		"text":     text,
	})
}

func investigationResultMsg(targetID string, isImpostor bool) []byte {
	return safeMarshal(map[string]interface{}{
		"type":       "investigation_result",
		"target":     targetID,
		"isImpostor": isImpostor,
	})
}

func playerDisconnectedMsg(playerID string) []byte {
	return safeMarshal(map[string]interface{}{
		"type":     "player_disconnected",
		"playerId": playerID,
	})
}

func playerReconnectedMsg(playerID string) []byte {
	return safeMarshal(map[string]interface{}{
		"type":     "player_reconnected",
		"playerId": playerID,
	})
}

func resumeStateMsg(r *Room, p *Player) []byte {
	m := map[string]interface{}{
		"type":     "resume_state",
		"phase":    r.Phase,
		"timer":    0,
		"isAlive":  p.IsAlive,
		"playerId": p.ID,
		"players":  buildPlayerList(r.Players),
	}
	if r.phaseTimer != nil {
		for phase, sec := range map[string]int{"night": r.Config.NightSeconds, "day": r.Config.DaySeconds, "voting": r.Config.VoteSeconds} {
			if r.Phase == phase {
				m["timer"] = sec
				break
			}
		}
	}
	if r.Phase == "night" && r.nightState != nil {
		voted := make([]string, 0)
		for _, pl := range r.Players {
			if pl.Role == "impostor" {
				if _, ok := r.nightState.Targets[pl.ID]; ok {
					voted = append(voted, pl.ID)
				}
			}
		}
		impostorCount := 0
		for _, pl := range r.Players {
			if pl.Role == "impostor" {
				impostorCount++
			}
		}
		m["voted"] = voted
		m["waiting"] = len(voted) < impostorCount
	}
	if r.Phase == "voting" && r.voteState != nil {
		type voteEntry struct {
			PlayerID string `json:"playerId"`
			Target   string `json:"target"`
		}
		votes := make([]voteEntry, 0)
		for pid, target := range r.voteState.Votes {
			votes = append(votes, voteEntry{PlayerID: pid, Target: target})
		}
		m["votes"] = votes
	}
	if r.Phase == "resolution" && r.nightResult != nil {
		var elimPtr *string
		var rolePtr *string
		if r.nightResult.eliminatedID != "" {
			elimPtr = &r.nightResult.eliminatedID
		}
		if r.nightResult.role != "" {
			rolePtr = &r.nightResult.role
		}
		m["eliminated"] = elimPtr
		m["eliminatedRole"] = rolePtr
	}
	if p.Role != "" {
		m["role"] = p.Role
		if p.Role == "impostor" {
			m["fellowImpostors"] = buildFellowImpostors(r.Players, p.ID)
		}
	}
	return safeMarshal(m)
}

func voteTallyMsg(vs *VoteState, players []*Player) []byte {
	type voteEntry struct {
		PlayerID string `json:"playerId"`
		Target   string `json:"target"`
	}
	votes := make([]voteEntry, 0)
	if vs != nil {
		for pid, target := range vs.Votes {
			votes = append(votes, voteEntry{PlayerID: pid, Target: target})
		}
	}
	return safeMarshal(map[string]interface{}{
		"type":  "vote_tally",
		"votes": votes,
	})
}

func gameOverMsg(r *Room, winner string) []byte {
	type playerResult struct {
		ID      string `json:"id"`
		Name    string `json:"name"`
		Role    string `json:"role"`
		IsAlive bool   `json:"isAlive"`
	}
	players := make([]playerResult, len(r.Players))
	for i, p := range r.Players {
		players[i] = playerResult{ID: p.ID, Name: p.Name, Role: p.Role, IsAlive: p.IsAlive}
	}
	return safeMarshal(map[string]interface{}{
		"type":    "game_over",
		"winner":  winner,
		"players": players,
	})
}
