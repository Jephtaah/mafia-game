package main

import "encoding/json"

type PlayerInfo struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	IsHost    bool   `json:"isHost"`
	Connected bool   `json:"connected"`
}

func errorMsg(msg string) []byte {
	b, _ := json.Marshal(map[string]string{"type": "error", "message": msg})
	return b
}

func roomCreatedMsg(r *Room, p *Player) []byte {
	players := make([]PlayerInfo, len(r.Players))
	for i, pl := range r.Players {
		players[i] = PlayerInfo{ID: pl.ID, Name: pl.Name, IsHost: pl.IsHost, Connected: pl.Connected}
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
		players[i] = PlayerInfo{ID: pl.ID, Name: pl.Name, IsHost: pl.IsHost, Connected: pl.Connected}
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
