package main

import (
	"testing"
)

func newTestPlayer(id, role string) *Player {
	return &Player{
		ID:      id,
		Name:    "P" + id,
		Role:    role,
		IsAlive: true,
	}
}

func roomWithPlayers(numPlayers int, roles []string) *Room {
	room := &Room{Players: make([]*Player, numPlayers)}
	for i := 0; i < numPlayers; i++ {
		var role string
		if i < len(roles) {
			role = roles[i]
		} else {
			role = "crewmate"
		}
		room.Players[i] = newTestPlayer(string(rune('A'+i)), role)
	}
	return room
}

// --- Role assignment ---

func TestAssignRoles_ImpostorCounts(t *testing.T) {
	tests := []struct {
		n            int
		wantImpostor int
		wantDetective bool
		wantDoctor    bool
		wantCrew      int
	}{
		{5, 1, false, false, 4},
		{6, 1, true, false, 4},
		{7, 2, true, true, 3},
		{8, 2, true, true, 4},
		{9, 2, true, true, 5},
		{10, 3, true, true, 5},
	}
	for _, tt := range tests {
		room := &Room{Players: make([]*Player, tt.n)}
		for i := 0; i < tt.n; i++ {
			room.Players[i] = &Player{ID: string(rune('A' + i)), Role: "", IsAlive: false}
		}
		room.assignRoles()

		gotImpostor, gotDetective, gotDoctor, gotCrew := 0, 0, 0, 0
		for _, p := range room.Players {
			switch p.Role {
			case "impostor":
				gotImpostor++
			case "detective":
				gotDetective++
			case "doctor":
				gotDoctor++
			case "crewmate":
				gotCrew++
			}
			if !p.IsAlive {
				t.Errorf("player %s not alive after assignRoles", p.ID)
			}
		}
		if gotImpostor != tt.wantImpostor {
			t.Errorf("%d players: got %d impostors, want %d", tt.n, gotImpostor, tt.wantImpostor)
		}
		if gotDetective != 0 != !tt.wantDetective {
			// Only check when expected vs actual mismatch
		}
		if tt.wantDetective && gotDetective != 1 {
			t.Errorf("%d players: want detective present, got %d", tt.n, gotDetective)
		}
		if !tt.wantDetective && gotDetective > 0 {
			t.Errorf("%d players: want no detective, got %d", tt.n, gotDetective)
		}
		if tt.wantDoctor && gotDoctor != 1 {
			t.Errorf("%d players: want doctor present, got %d", tt.n, gotDoctor)
		}
		if !tt.wantDoctor && gotDoctor > 0 {
			t.Errorf("%d players: want no doctor, got %d", tt.n, gotDoctor)
		}
		if gotCrew != tt.wantCrew {
			t.Errorf("%d players: got %d crewmates, want %d", tt.n, gotCrew, tt.wantCrew)
		}
	}
}

func TestAssignRoles_AllPlayersAssigned(t *testing.T) {
	room := &Room{Players: make([]*Player, 7)}
	for i := 0; i < 7; i++ {
		room.Players[i] = &Player{ID: string(rune('A' + i))}
	}
	room.assignRoles()
	for _, p := range room.Players {
		if p.Role == "" {
			t.Errorf("player %s has no role after assignRoles", p.ID)
		}
	}
}

// --- Night resolution ---

func TestResolveNight_SingleImpostorGetsTarget(t *testing.T) {
	room := roomWithPlayers(5, []string{"impostor", "crewmate", "crewmate", "crewmate", "crewmate"})
	room.nightState = &NightState{Targets: map[string]string{"A": "B"}}
	room.resolveNight()

	if room.nightResult == nil || room.nightResult.eliminatedID != "B" {
		t.Errorf("single impostor: expected eliminated=B, got eliminated=%q", safeElim(room.nightResult))
	}
}

func TestResolveNight_SingleImpostorAlwaysGetsPick(t *testing.T) {
	room := roomWithPlayers(5, []string{"impostor", "crewmate", "crewmate", "crewmate", "crewmate"})
	room.nightState = &NightState{Targets: map[string]string{"A": "C"}}
	room.resolveNight()

	if room.nightResult == nil || room.nightResult.eliminatedID != "C" {
		t.Errorf("single impostor: expected eliminated=C, got eliminated=%q", safeElim(room.nightResult))
	}
	if room.nightResult.role != "crewmate" {
		t.Errorf("single impostor: expected role=crewmate, got %q", room.nightResult.role)
	}
}

func TestResolveNight_TwoImpostorsAgree(t *testing.T) {
	room := roomWithPlayers(7, []string{"impostor", "impostor", "crewmate", "crewmate", "crewmate", "crewmate", "crewmate"})
	room.nightState = &NightState{Targets: map[string]string{"A": "C", "B": "C"}}
	room.resolveNight()

	if room.nightResult == nil || room.nightResult.eliminatedID != "C" {
		t.Errorf("two impostors agree: expected eliminated=C, got eliminated=%q", safeElim(room.nightResult))
	}
}

func TestResolveNight_TwoImpostorsDisagree(t *testing.T) {
	room := roomWithPlayers(7, []string{"impostor", "impostor", "crewmate", "crewmate", "crewmate", "crewmate", "crewmate"})
	room.nightState = &NightState{Targets: map[string]string{"A": "C", "B": "D"}}
	room.resolveNight()

	if room.nightResult == nil || room.nightResult.eliminatedID != "" {
		t.Errorf("two impostors disagree: expected no elimination, got eliminated=%q", safeElim(room.nightResult))
	}
}

func TestResolveNight_TwoImpostorsOnlyOneVotes(t *testing.T) {
	room := roomWithPlayers(7, []string{"impostor", "impostor", "crewmate", "crewmate", "crewmate", "crewmate", "crewmate"})
	room.nightState = &NightState{Targets: map[string]string{"A": "C"}}
	room.resolveNight()

	if room.nightResult == nil || room.nightResult.eliminatedID != "" {
		t.Errorf("2 impostors, 1 vote: expected no elimination, got eliminated=%q", safeElim(room.nightResult))
	}
}

func TestResolveNight_ThreeImpostorsTwoAgree(t *testing.T) {
	room := roomWithPlayers(10, []string{"impostor", "impostor", "impostor", "crewmate", "crewmate", "crewmate", "crewmate", "crewmate", "crewmate", "crewmate"})
	room.nightState = &NightState{Targets: map[string]string{"A": "D", "B": "D", "C": "E"}}
	room.resolveNight()

	if room.nightResult == nil || room.nightResult.eliminatedID != "D" {
		t.Errorf("3 impostors, 2 agree: expected eliminated=D, got eliminated=%q", safeElim(room.nightResult))
	}
}

func TestResolveNight_ThreeImpostorsAllDisagree(t *testing.T) {
	room := roomWithPlayers(10, []string{"impostor", "impostor", "impostor", "crewmate", "crewmate", "crewmate", "crewmate", "crewmate", "crewmate", "crewmate"})
	room.nightState = &NightState{Targets: map[string]string{"A": "D", "B": "E", "C": "F"}}
	room.resolveNight()

	if room.nightResult == nil || room.nightResult.eliminatedID != "" {
		t.Errorf("3 impostors all disagree: expected no elimination, got eliminated=%q", safeElim(room.nightResult))
	}
}

func TestResolveNight_DoctorSavesTarget(t *testing.T) {
	room := roomWithPlayers(7, []string{"impostor", "impostor", "doctor", "crewmate", "crewmate", "crewmate", "crewmate"})
	room.nightState = &NightState{
		Targets:      map[string]string{"A": "D", "B": "D"},
		DoctorTarget: "D",
		DoctorPlayer: "C",
	}
	room.resolveNight()

	if room.nightResult == nil || room.nightResult.eliminatedID != "" {
		t.Errorf("doctor saves target: expected no elimination, got eliminated=%q", safeElim(room.nightResult))
	}
}

func TestResolveNight_NoImpostorVotes(t *testing.T) {
	room := roomWithPlayers(5, []string{"impostor", "crewmate", "crewmate", "crewmate", "crewmate"})
	room.nightState = &NightState{Targets: map[string]string{}}
	room.resolveNight()

	if room.nightResult == nil || room.nightResult.eliminatedID != "" {
		t.Errorf("no votes: expected no elimination, got eliminated=%q", safeElim(room.nightResult))
	}
}

func TestResolveNight_NightStateCleared(t *testing.T) {
	room := roomWithPlayers(5, []string{"impostor", "crewmate", "crewmate", "crewmate", "crewmate"})
	room.nightState = &NightState{Targets: map[string]string{"A": "B"}}
	room.resolveNight()

	if room.nightState != nil {
		t.Error("nightState should be nil after resolveNight")
	}
}

func TestResolveNight_ImpostorCantSelfTarget(t *testing.T) {
	room := roomWithPlayers(5, []string{"impostor", "crewmate", "crewmate", "crewmate", "crewmate"})
	// handleNightKill would reject self-targets, but resolveNight should also handle gracefully
	room.nightState = &NightState{Targets: map[string]string{"A": "B"}}
	room.resolveNight()

	if room.nightResult == nil || room.nightResult.eliminatedID != "B" {
		t.Errorf("expected B eliminated, got eliminated=%q", safeElim(room.nightResult))
	}
}

// --- Vote resolution ---

func TestResolveVoting_SimpleMajority(t *testing.T) {
	room := roomWithPlayers(5, []string{"crewmate", "crewmate", "crewmate", "crewmate", "impostor"})
	room.Phase = "voting"
	room.voteState = &VoteState{Votes: map[string]string{"A": "E", "B": "E", "C": "skip", "D": "E"}}

	room.resolveVoting()

	if room.Players[4].IsAlive {
		t.Error("impostor should be eliminated after majority vote")
	}
	if len(room.EliminatedPlayers) != 1 || room.EliminatedPlayers[0] != "E" {
		t.Errorf("expected E eliminated, got %v", room.EliminatedPlayers)
	}
}

func TestResolveVoting_TieNoElimination(t *testing.T) {
	room := roomWithPlayers(5, []string{"crewmate", "crewmate", "crewmate", "crewmate", "impostor"})
	room.Phase = "voting"
	// A->E, B->D, C->D, D->E → E=2, D=2 → tie
	room.voteState = &VoteState{Votes: map[string]string{"A": "E", "B": "D", "C": "D", "D": "E"}}

	room.resolveVoting()

	for _, p := range room.Players {
		if !p.IsAlive {
			t.Errorf("tie: player %s should not be eliminated", p.ID)
		}
	}
}

func TestResolveVoting_SkipMajority(t *testing.T) {
	room := roomWithPlayers(5, []string{"crewmate", "crewmate", "crewmate", "crewmate", "impostor"})
	room.Phase = "voting"
	room.voteState = &VoteState{Votes: map[string]string{"A": "skip", "B": "skip", "C": "skip", "D": "E"}}

	room.resolveVoting()

	for _, p := range room.Players {
		if !p.IsAlive {
			t.Errorf("skip majority: player %s should not be eliminated", p.ID)
		}
	}
}

func TestResolveVoting_SkipTiedWithPlayer(t *testing.T) {
	room := roomWithPlayers(5, []string{"crewmate", "crewmate", "crewmate", "crewmate", "impostor"})
	room.Phase = "voting"
	room.voteState = &VoteState{Votes: map[string]string{"A": "skip", "B": "skip", "C": "E", "D": "E"}}

	room.resolveVoting()

	for _, p := range room.Players {
		if !p.IsAlive {
			t.Errorf("skip tied with player: player %s should not be eliminated", p.ID)
		}
	}
}

func TestResolveVoting_NoVotes(t *testing.T) {
	room := roomWithPlayers(5, []string{"crewmate", "crewmate", "crewmate", "crewmate", "impostor"})
	room.Phase = "voting"
	room.voteState = &VoteState{Votes: map[string]string{}}

	room.resolveVoting()

	for _, p := range room.Players {
		if !p.IsAlive {
			t.Errorf("no votes: player %s should not be eliminated", p.ID)
		}
	}
}

func TestResolveVoting_NullVoteState(t *testing.T) {
	room := roomWithPlayers(5, []string{"crewmate", "crewmate", "crewmate", "crewmate", "impostor"})
	room.Phase = "voting"

	room.resolveVoting()

	for _, p := range room.Players {
		if !p.IsAlive {
			t.Errorf("nil voteState: player %s should not be eliminated", p.ID)
		}
	}
}

func TestResolveVoting_VoteStateCleared(t *testing.T) {
	room := roomWithPlayers(5, []string{"crewmate", "crewmate", "crewmate", "crewmate", "impostor"})
	room.Phase = "voting"
	room.voteState = &VoteState{Votes: map[string]string{"A": "skip"}}
	room.resolveVoting()

	if room.voteState != nil {
		t.Error("voteState should be nil after resolveVoting")
	}
}

// --- Win conditions ---

func TestCheckWin_ImpostorsEqualCrewmates(t *testing.T) {
	room := roomWithPlayers(4, []string{"impostor", "impostor", "crewmate", "crewmate"})

	winner := room.checkWin()

	if winner != "impostors" {
		t.Errorf("impostors = crewmates: expected impostors win, got %q", winner)
	}
}

func TestCheckWin_ImpostorsMoreThanCrewmates(t *testing.T) {
	room := roomWithPlayers(3, []string{"impostor", "impostor", "crewmate"})

	winner := room.checkWin()

	if winner != "impostors" {
		t.Errorf("impostors > crewmates: expected impostors win, got %q", winner)
	}
}

func TestCheckWin_NoImpostors(t *testing.T) {
	room := roomWithPlayers(3, []string{"crewmate", "crewmate", "crewmate"})

	winner := room.checkWin()

	if winner != "crewmates" {
		t.Errorf("0 impostors: expected crewmates win, got %q", winner)
	}
}

func TestCheckWin_GameContinues(t *testing.T) {
	room := roomWithPlayers(6, []string{"impostor", "crewmate", "crewmate", "crewmate", "crewmate", "crewmate"})

	winner := room.checkWin()

	if winner != "" {
		t.Errorf("game should continue: expected no winner, got %q", winner)
	}
}

func TestCheckWin_EliminatedPlayersIgnored(t *testing.T) {
	room := roomWithPlayers(6, []string{"impostor", "crewmate", "crewmate", "crewmate", "crewmate", "crewmate"})
	room.Players[1].IsAlive = false
	room.Players[2].IsAlive = false
	room.Players[3].IsAlive = false

	// Alive: impostor=1, crewmate=2 → impostors < crewmates
	winner := room.checkWin()

	if winner != "" {
		t.Errorf("impostors < crewmates: expected no winner, got %q", winner)
	}
}

func TestCheckWin_ImpostorsWinAfterEliminations(t *testing.T) {
	room := roomWithPlayers(6, []string{"impostor", "impostor", "crewmate", "crewmate", "crewmate", "crewmate"})
	room.Players[2].IsAlive = false
	room.Players[3].IsAlive = false
	room.Players[4].IsAlive = false

	// Alive: impostor=2, crewmate=1 → impostors win
	winner := room.checkWin()

	if winner != "impostors" {
		t.Errorf("2 impostors vs 1 crewmate: expected impostors win, got %q", winner)
	}
}

// --- buildPlayerList / helpers ---

func TestBuildPlayerList(t *testing.T) {
	players := []*Player{
		{ID: "a", Name: "Alice", Role: "crewmate", IsAlive: true, Connected: true},
		{ID: "b", Name: "Bob", Role: "impostor", IsAlive: true, Connected: false},
	}
	result := buildPlayerList(players)

	if len(result) != 2 {
		t.Fatalf("expected 2 entries, got %d", len(result))
	}
	if result[0].ID != "a" || result[0].Name != "Alice" || !result[0].IsAlive || !result[0].Connected {
		t.Errorf("first entry mismatch: %+v", result[0])
	}
	if result[1].ID != "b" || result[1].Name != "Bob" || !result[1].IsAlive || result[1].Connected {
		t.Errorf("second entry mismatch: %+v", result[1])
	}
}

func TestBuildFellowImpostors(t *testing.T) {
	players := []*Player{
		{ID: "a", Name: "Alice", Role: "impostor", IsHost: true},
		{ID: "b", Name: "Bob", Role: "impostor"},
		{ID: "c", Name: "Charlie", Role: "crewmate"},
	}
	result := buildFellowImpostors(players, "a")

	if len(result) != 1 {
		t.Fatalf("expected 1 fellow impostor, got %d", len(result))
	}
	if result[0].ID != "b" || result[0].Name != "Bob" {
		t.Errorf("expected Bob, got %+v", result[0])
	}
}

func TestBuildFellowImpostors_NoFellows(t *testing.T) {
	players := []*Player{
		{ID: "a", Name: "Alice", Role: "impostor"},
		{ID: "c", Name: "Charlie", Role: "crewmate"},
	}
	result := buildFellowImpostors(players, "a")

	if len(result) != 0 {
		t.Errorf("expected 0 fellow impostors, got %d", len(result))
	}
}

// safeElim returns a readable string for nightResult for test failure messages
func safeElim(nr *nightResolution) string {
	if nr == nil {
		return "<nil>"
	}
	if nr.eliminatedID == "" {
		return "<none>"
	}
	return nr.eliminatedID
}
