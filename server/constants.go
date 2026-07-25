package main

var ImpostorCounts = map[int]int{5: 1, 6: 1, 7: 2, 8: 2, 9: 2, 10: 3}

const (
	DefaultNightSeconds = 30
	DefaultDaySeconds   = 60
	DefaultVoteSeconds  = 45
	ResolutionDelay     = 5

	MinPhaseSeconds = 10
	MaxPhaseSeconds = 120

	MinPlayers     = 5
	MaxPlayers     = 10
	RoomCodeLength = 4

	ReconnectGraceSeconds = 30
	RoomEmptyGraceSeconds = 30
	LobbyAbandonMinutes   = 20
	NameMaxLength         = 20
	ChatMaxLength         = 500
)
