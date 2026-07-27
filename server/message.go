package main

import "encoding/json"

type PlayerInfo struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	IsHost    bool   `json:"isHost"`
	IsAlive   bool   `json:"isAlive"`
	Connected bool   `json:"connected"`
}

func errorMsg(msg string) []byte {
	b, _ := json.Marshal(map[string]string{"type": "error", "message": msg})
	return b
}

func roomCreatedMsg(r *Room, p *Player) []byte {
	players := make([]PlayerInfo, len(r.Players))
	for i, pl := range r.Players {
		players[i] = PlayerInfo{ID: pl.ID, Name: pl.Name, IsHost: pl.IsHost, IsAlive: pl.IsAlive, Connected: pl.Connected}
	}
	b, _ := json.Marshal(map[string]interface{}{
		"type":     "room_created",
		"code":     r.Code,
		"playerId": p.ID,
		"token":    p.Token,
		"players":  players,
		"isHost":   p.IsHost,
	})
	return b
}

func playerListMsg(r *Room) []byte {
	players := make([]PlayerInfo, len(r.Players))
	for i, pl := range r.Players {
		players[i] = PlayerInfo{ID: pl.ID, Name: pl.Name, IsHost: pl.IsHost, IsAlive: pl.IsAlive, Connected: pl.Connected}
	}
	b, _ := json.Marshal(map[string]interface{}{
		"type":    "player_list",
		"players": players,
	})
	return b
}

func phaseChangeMsg(phase string, seconds int) []byte {
	b, _ := json.Marshal(map[string]interface{}{
		"type":  "phase_change",
		"phase": phase,
		"timer": seconds,
	})
	return b
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
	b, _ := json.Marshal(map[string]interface{}{
		"type":   "night_status",
		"voted":  voted,
		"waiting": waiting,
	})
	return b
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
	b, _ := json.Marshal(map[string]interface{}{
		"type":       "resolution",
		"eliminated": elimPtr,
		"role":       rolePtr,
	})
	return b
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
	b, _ := json.Marshal(map[string]interface{}{
		"type":       "elimination",
		"eliminated": elimPtr,
		"role":       rolePtr,
	})
	return b
}

func chatMessage(p *Player, text string) []byte {
	b, _ := json.Marshal(map[string]interface{}{
		"type":     "chat_message",
		"playerId": p.ID,
		"name":     p.Name,
		"text":     text,
	})
	return b
}

func investigationResultMsg(targetID string, isImpostor bool) []byte {
	b, _ := json.Marshal(map[string]interface{}{
		"type":       "investigation_result",
		"target":     targetID,
		"isImpostor": isImpostor,
	})
	return b
}

func playerDisconnectedMsg(playerID string) []byte {
	b, _ := json.Marshal(map[string]interface{}{
		"type":     "player_disconnected",
		"playerId": playerID,
	})
	return b
}

func playerReconnectedMsg(playerID string) []byte {
	b, _ := json.Marshal(map[string]interface{}{
		"type":     "player_reconnected",
		"playerId": playerID,
	})
	return b
}

func resumeStateMsg(r *Room, p *Player) []byte {
	players := make([]PlayerInfo, len(r.Players))
	for i, pl := range r.Players {
		players[i] = PlayerInfo{ID: pl.ID, Name: pl.Name, IsHost: pl.IsHost, IsAlive: pl.IsAlive, Connected: pl.Connected}
	}
	m := map[string]interface{}{
		"type":     "resume_state",
		"phase":    r.Phase,
		"timer":    0,
		"isAlive":  p.IsAlive,
		"playerId": p.ID,
		"players":  players,
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
			var fellows []PlayerInfo
			for _, pl := range r.Players {
				if pl.Role == "impostor" && pl.ID != p.ID {
					fellows = append(fellows, PlayerInfo{ID: pl.ID, Name: pl.Name, IsHost: pl.IsHost, IsAlive: pl.IsAlive, Connected: pl.Connected})
				}
			}
			m["fellowImpostors"] = fellows
		}
	}
	b, _ := json.Marshal(m)
	return b
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
	b, _ := json.Marshal(map[string]interface{}{
		"type":  "vote_tally",
		"votes": votes,
	})
	return b
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
	b, _ := json.Marshal(map[string]interface{}{
		"type":    "game_over",
		"winner":  winner,
		"players": players,
	})
	return b
}
