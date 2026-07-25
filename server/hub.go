package main

import (
	"crypto/rand"
	"math/big"
	"sync"
	"time"
)

type Hub struct {
	mu    sync.RWMutex
	Rooms map[string]*Room
}

func NewHub() *Hub {
	return &Hub{Rooms: make(map[string]*Room)}
}

func (h *Hub) CreateRoom(config RoomConfig) (*Room, string) {
	code := h.generateCode()
	room := &Room{
		Code:      code,
		Players:   make([]*Player, 0),
		Phase:     "lobby",
		Config:    config,
		CreatedAt: time.Now(),
		Intents:   make(chan Intent, 32),
		done:      make(chan struct{}),
		onTeardown: func(c string) {
			h.mu.Lock()
			delete(h.Rooms, c)
			h.mu.Unlock()
		},
	}
	h.mu.Lock()
	h.Rooms[code] = room
	h.mu.Unlock()
	go room.Run()
	return room, code
}

func (h *Hub) LookupRoom(code string) (*Room, bool) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	r, ok := h.Rooms[code]
	return r, ok
}

func (h *Hub) generateCode() string {
	const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
	for {
		code := ""
		for i := 0; i < RoomCodeLength; i++ {
			n, _ := rand.Int(rand.Reader, big.NewInt(int64(len(chars))))
			code += string(chars[n.Int64()])
		}
		h.mu.RLock()
		_, exists := h.Rooms[code]
		h.mu.RUnlock()
		if !exists {
			return code
		}
	}
}
