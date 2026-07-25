# PRD: Real-Time Social Deduction Game (Mafia Game)

## 1. Overview

A browser-based, real-time multiplayer social deduction game in the style of Mafia/Among Us. Players join a room via a shareable link, receive a secret role, and alternate through Night and Day phases until one side wins. Built for a hackathon demo where judges and attendees join and play live on their own phones.

**Backend:** Go (WebSockets, goroutines, channels)
**Frontend:** React (Vite) + Tailwind, native WebSocket API

## 2. Problem / Motivation

Most hackathon demos are watched, not played. This project is designed so judges become active participants within the first two minutes of the demo, each staring at a different secret screen, which creates a stronger impression than any slide or scripted walkthrough. It also gives a legitimate, defensible reason to use Go: the game requires genuine concurrent state management, per-player hidden information, and real-time synchronization across many connections, not just "we picked Go for no reason."

## 3. Goals

- Ship a fully playable core loop (join, role, night, day, vote, win) before the deadline.
- Support 5 to 10 concurrent players per room, with multiple rooms running independently.
- Guarantee no player can ever see another player's hidden role or private information, including via inspecting network traffic.
- Make the live demo experience feel snappy and dramatic (timers, live vote tallies, role reveals).

## 4. Non-Goals (Out of Scope for Hackathon)

- Persistent accounts, login, or player history across sessions.
- Matchmaking or public room browsing (rooms are joined by direct link/code only).
- Mobile native apps (browser only, mobile-responsive web).
- Anti-cheat beyond basic hidden-info correctness (not hardened against a determined attacker).
- Voice or video chat (text chat only).

## 5. Core Gameplay Rules

### 5.1 Roles

| Role                | Count                          | Ability                                                                                      |
| ------------------- | ------------------------------ | -------------------------------------------------------------------------------------------- |
| Crewmate / Villager | Majority                       | No special ability. Votes during Day phase.                                                  |
| Impostor / Mafia    | 1 to 3, scaled by player count | Secretly chooses one player to eliminate each Night. Knows the identity of fellow Impostors. |
| Detective (stretch) | 1, optional                    | Each Night, secretly checks one player and learns Impostor or not.                           |
| Doctor (stretch)    | 1, optional                    | Each Night, picks one player to protect from elimination.                                    |

**Impostor count scaling:**

- 5 to 6 players: 1 Impostor
- 7 to 9 players: 2 Impostors
- 10 players: 3 Impostors

MVP ships with Crewmate and Impostor only. Detective and Doctor are added only if time allows.

### 5.2 Phase Loop

Lobby → Night → Resolution → Day (Discussion) → Voting → Elimination → loop to Night, or End if a win condition is met.

### 5.3 Phase Details

- **Lobby:** Players join with a display name. Host starts the game once enough players have joined. Server randomly assigns roles at start.
- **Night:** Impostors privately select a target. Detective/Doctor (if enabled) privately act. All other players see a waiting screen. Timed.
- **Resolution:** Server resolves the night's actions (applies Doctor save if applicable, applies Detective result privately). Broadcasts a public outcome: who died, or no one.
- **Day / Discussion:** All surviving players share a live text chat to discuss and accuse. Timed.
- **Voting:** Each surviving player votes for one player to eliminate, or skips. Live tally visible to all. Majority elimination at timer end.
- **Elimination:** Eliminated player's role is revealed to everyone. Win condition is checked.

### 5.4 Tie-Breaking and Edge Cases

- Night: if Impostors (in 2 or 3 Impostor games) do not reach majority agreement, or timer expires with no valid pick, no elimination occurs that night.
- Day vote: a tie, or a skip-majority, results in no elimination. Game proceeds to the next Night.
- Default fallback for any ambiguous outcome is always "no elimination," never an undefined state.

### 5.5 Win Conditions

- Impostors win the moment their count is greater than or equal to the remaining Crewmate count.
- Crewmates win the moment the Impostor count reaches zero.
- Checked immediately after every elimination (Night or Day).

## 6. Functional Requirements

1. A player can create a room and receive a shareable link or short code.
2. A player can join a room using that link or code and choose a display name.
3. The host can start the game once the room has enough players (minimum 5).
4. On game start, the server randomly assigns roles, respecting the scaling table above.
5. Each player receives only their own role privately. Impostors additionally receive the identity of fellow Impostors.
6. During Night, only players with an active role ability see an action prompt; all others see a waiting state.
7. The server resolves Night actions and broadcasts a single public outcome to all players simultaneously.
8. During Day, all surviving players can send and receive chat messages in real time.
9. During Voting, all surviving players can cast one vote; a live tally is visible to all.
10. The server enforces majority elimination logic and broadcasts the result, including the eliminated player's revealed role.
11. The server checks win conditions after every elimination and ends the game with a result screen when met.
12. A disconnected player has a short grace period to reconnect and resume their session without disrupting the room.

## 7. Non-Functional Requirements

- **Hidden information integrity:** No message sent to a client may contain another player's private role, action, or vote-in-progress data beyond what the rules explicitly allow (e.g., Impostors seeing each other).
- **Authoritative server:** All game logic, timers, and outcome resolution live server-side. The client never determines game state, only displays it and submits intents.
- **Room isolation:** Rooms operate independently; state or messages must never leak across rooms.
- **Concurrency safety:** Each room's state must only be mutated by that room's own goroutine, avoiding shared-state race conditions.
- **Responsiveness:** Phase transitions, chat, and vote tally updates should feel near-instant (sub-second) to support a live demo.

## 8. Technical Architecture (Summary)

- **Backend (Go):**
  - One goroutine per room acting as the single source of truth for that room's state (lobby, phase, players, roles, votes, chat).
  - One goroutine per player connection, handling reads/writes over its WebSocket.
  - Player-connection goroutines feed intents (join, act, vote, chat) into their room's goroutine via channels; the room goroutine is the only writer of room state.
  - The room goroutine computes a personalized broadcast payload per player before sending, so private information is filtered at the source, not on the client.
- **Frontend (React + Vite + Tailwind):**
  - A single WebSocket connection per client, opened after entering name and room code.
  - App state driven by a `phase` field from the server; UI swaps between Lobby, Role Reveal, Night, Day/Chat, Voting, and End screens accordingly.
  - No game logic on the client; it only renders server state and sends player intents.

## 9. Build Plan / Milestones

1. Bare WebSocket connection: server accepts connections, echoes messages, frontend sends/receives.
2. Room and lobby: create room, join room, see other players join live.
3. Role assignment and Night phase with Impostors only (core hidden-info mechanic).
4. Resolution and Day/chat phase.
5. Voting, Elimination, and win-condition checking (completes the core loop).
6. Stretch, only if time remains: Detective and Doctor roles, reconnection handling, timer/animation polish.

## 10. Risks and Mitigations

| Risk                                                        | Mitigation                                                                                      |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Private role data leaks to wrong client                     | Centralize all broadcast construction in the room goroutine; never trust client-side filtering. |
| Live demo Wi-Fi/connection drops mid-game                   | Basic reconnection grace period; test on venue Wi-Fi ahead of time, not just localhost.         |
| Odd player counts break vote majority logic                 | Explicit tie and skip handling defined up front (see 5.4), tested before demo.                  |
| Scope creep into Detective/Doctor before core loop is solid | Build order strictly locks stretch roles behind a fully working Crewmate/Impostor loop.         |

## 11. Success Criteria for Demo

- 5 or more real players (ideally including judges) join and complete at least one full game live.
- No visible bugs where a player sees information they should not have access to.
- At least one full Night through Voting cycle completes within the judging time slot.
- Judges can articulate back, unprompted, why Go was the right technical choice after seeing the architecture explained.
