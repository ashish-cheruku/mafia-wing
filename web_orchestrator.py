"""
WebGameOrchestrator: subclass of GameOrchestrator that emits typed SSE events
without modifying any existing game files.
"""
import random
import re
import time
from datetime import datetime
from typing import Callable

from game_orchestrator import GameOrchestrator
from game_state import GameAction, GamePhase


# ---------------------------------------------------------------------------
# Regex patterns — all use (.+?) / (.+) to handle multi-word player names
# ---------------------------------------------------------------------------

_PATTERNS = [
    # Game initialization
    ("game_setup",      re.compile(r"Game Setup Complete", re.IGNORECASE)),

    # Phase changes
    ("phase_night",     re.compile(r"Round (\d+) - Night Phase",   re.IGNORECASE)),
    ("phase_day",       re.compile(r"Round (\d+) - Day Phase",     re.IGNORECASE)),
    ("phase_voting",    re.compile(r"Starting voting phase",        re.IGNORECASE)),
    ("phase_defense",   re.compile(r"(.+?) defense phase starting", re.IGNORECASE)),

    # Night actions  (multi-word names handled)
    ("mafia_propose",   re.compile(r"  (.+?) proposes: (.+?) \((.+)\)$")),
    ("mafia_consensus", re.compile(r"Mafia consensus: Eliminate (.+)$",         re.IGNORECASE)),
    ("doctor_save",     re.compile(r"Doctor saves: (.+?) \(",                   re.IGNORECASE)),
    ("detective_check", re.compile(r"Detective investigates: (.+?) \(Role: (\w+)\)", re.IGNORECASE)),
    ("night_no_elim",   re.compile(r"Doctor.s save prevented (.+?) from",       re.IGNORECASE)),
    ("night_elim",      re.compile(r"Mafia successfully eliminated (.+)$",       re.IGNORECASE)),

    # Day discussion  — format: "NAME (role): message"
    ("discussion",      re.compile(r"^(.+?) \((\w+)\): (.+)$")),

    # Voting  (multi-word names)
    ("vote_cast",       re.compile(r"^(.+?) \((\w+)\) votes for (.+?): (.+)$")),
    ("trial_start",     re.compile(r"(.+?) on trial with (\d+) votes? \((\w+)\)")),
    ("defense",         re.compile(r"^(.+?) \((\w+)\) defense: (.+)$")),
    ("final_vote",      re.compile(r"Final voting phase after (.+?)'s defense", re.IGNORECASE)),
    ("day_elim",        re.compile(r"(.+?) eliminated in final vote \((\w+)\)")),
    ("tie",             re.compile(r"Final vote tied:.*no elimination",          re.IGNORECASE)),

    # Game over
    ("game_over_v",     re.compile(r"VILLAGE WINS",  re.IGNORECASE)),
    ("game_over_m",     re.compile(r"MAFIA WINS",    re.IGNORECASE)),
    ("game_over_t",     re.compile(r"TIE GAME",      re.IGNORECASE)),
]

# Roles that should NOT be classified as discussion lines (to avoid false positives)
_VALID_ROLES = {"mafia", "doctor", "detective", "villager"}


def _classify(msg: str) -> dict | None:
    """Return a typed event dict for the message, or None if unclassified."""
    for name, pat in _PATTERNS:
        m = pat.search(msg)
        if not m:
            continue

        if name == "game_setup":
            return {"type": "game_setup"}

        if name == "phase_night":
            return {"type": "phase_change", "phase": "night", "round_number": int(m.group(1))}

        if name == "phase_day":
            return {"type": "phase_change", "phase": "day", "round_number": int(m.group(1))}

        if name == "phase_voting":
            return {"type": "phase_change", "phase": "voting"}

        if name == "phase_defense":
            return {"type": "phase_change", "phase": "defense", "suspect": m.group(1).strip()}

        if name == "mafia_propose":
            return {"type": "night_action", "actor": m.group(1).strip(),
                    "actor_role": "mafia", "target": m.group(2).strip(), "reason": m.group(3)}

        if name == "mafia_consensus":
            return {"type": "night_action", "actor_role": "mafia_consensus",
                    "target": m.group(1).strip(), "message": f"Mafia consensus: eliminate {m.group(1).strip()}"}

        if name == "doctor_save":
            return {"type": "night_action", "actor_role": "doctor",
                    "target": m.group(1).strip(), "message": f"Doctor saves {m.group(1).strip()}"}

        if name == "detective_check":
            return {"type": "night_action", "actor_role": "detective",
                    "target": m.group(1).strip(), "result": m.group(2),
                    "message": f"Detective: {m.group(1).strip()} is {m.group(2)}"}

        if name == "night_no_elim":
            return {"type": "night_resolved", "eliminated": None,
                    "saved": m.group(1).strip(), "message": msg}

        if name == "night_elim":
            return {"type": "night_resolved", "eliminated": m.group(1).strip(),
                    "saved": None, "message": msg}

        if name == "discussion":
            role = m.group(2)
            # Skip lines that look like votes or other structured messages
            if role not in _VALID_ROLES:
                continue
            return {"type": "chat_message", "player_name": m.group(1).strip(),
                    "message": m.group(3)}

        if name == "vote_cast":
            role = m.group(2)
            if role not in _VALID_ROLES:
                continue
            return {"type": "vote_cast", "voter": m.group(1).strip(), "voter_role": role,
                    "target": m.group(3).strip(), "reason": m.group(4)}

        if name == "trial_start":
            return {"type": "trial_start", "suspect": m.group(1).strip(),
                    "votes": int(m.group(2)), "suspect_role": m.group(3)}

        if name == "defense":
            role = m.group(2)
            if role not in _VALID_ROLES:
                continue
            return {"type": "defense", "suspect": m.group(1).strip(),
                    "suspect_role": role, "defense": m.group(3)}

        if name == "final_vote":
            return {"type": "phase_change", "phase": "final_voting", "suspect": m.group(1).strip()}

        if name == "day_elim":
            return {"type": "elimination", "player_name": m.group(1).strip(),
                    "role": m.group(2), "phase": "day"}

        if name == "tie":
            return {"type": "vote_tied", "message": msg}

        if name == "game_over_v":
            return {"type": "game_over", "winner": "village"}

        if name == "game_over_m":
            return {"type": "game_over", "winner": "mafia"}

        if name == "game_over_t":
            return {"type": "game_over", "winner": "tie"}

    return None


# Event types that should carry round_number
_ROUND_TAGGED = {"chat_message", "night_action", "night_resolved",
                 "vote_cast", "trial_start", "defense", "elimination"}


class WebGameOrchestrator(GameOrchestrator):
    """
    Extends GameOrchestrator to push typed SSE events via event_callback.
    Overrides _observer_info (zero changes to original files).
    Also overrides _run_discussion_phase for true round-robin equal participation.
    """

    def __init__(self, event_callback: Callable[[dict], None], **kwargs):
        self._event_callback = event_callback
        super().__init__(**kwargs)

    # ------------------------------------------------------------------
    # Intercept every observer message → classify → emit SSE event
    # ------------------------------------------------------------------
    def _observer_info(self, message: str):
        super()._observer_info(message)

        event = _classify(message)
        if event is None:
            event = {"type": "raw_log", "message": message}

        # Enrich with current round number
        if event.get("type") in _ROUND_TAGGED:
            event["round_number"] = self.game_state.round_number

        self._event_callback(event)

    # ------------------------------------------------------------------
    # Round-robin discussion: every alive player speaks once per round
    # ------------------------------------------------------------------
    def _run_discussion_phase(self):
        self.game_state.phase = GamePhase.DAY_DISCUSSION
        self._player_announce("\nDiscussion Phase")

        alive_agents = [
            self.agents[name]
            for name in self.game_state.alive_players
            if name in self.agents
        ]

        for _round_idx in range(self.max_discussion_rounds):
            order = alive_agents.copy()
            random.shuffle(order)

            for agent in order:
                try:
                    context = agent.get_base_context(self.game_state)
                    self._log_agent_context(
                        agent.name, context,
                        f"Round {self.game_state.round_number} Discussion",
                    )
                    response = agent.participate_in_discussion(self.game_state)

                    # Accept comment regardless of speak flag so everyone participates
                    if hasattr(response, "comment") and response.comment:
                        comment = response.comment
                    elif isinstance(response, str) and response:
                        comment = response
                    else:
                        continue

                    self._player_announce(f"{agent.name}: {comment}")
                    self._observer_info(f"{agent.name} ({agent.role.value}): {comment}")

                    action = GameAction(
                        player_name=agent.name,
                        action_type="discussion",
                        message=comment,
                        timestamp=datetime.now().isoformat(),
                        round_number=self.game_state.round_number,
                    )
                    self.game_state.discussion_messages.append(action)
                    time.sleep(0.3)

                except Exception as exc:
                    self._observer_info(
                        f"Error getting response from {agent.name}: {exc}"
                    )

    # ------------------------------------------------------------------
    # Emit rich game_over event with full final state
    # ------------------------------------------------------------------
    def _announce_winner(self) -> str:
        result = super()._announce_winner()

        final_states = [
            {"name": p.name, "role": p.role.value, "is_alive": p.is_alive}
            for p in self.game_state.players
        ]
        self._event_callback({
            "type": "game_over",
            "winner": self.game_state.winner,
            "final_player_states": final_states,
            "elimination_order": list(self.game_state.elimination_history),
        })
        return result

    # ------------------------------------------------------------------
    # Emit game_init after setup
    # ------------------------------------------------------------------
    def initialize_game(self):
        super().initialize_game()

        players = [
            {"name": p.name, "role": p.role.value, "personality": p.personality}
            for p in self.game_state.players
        ]
        self._event_callback({"type": "game_init", "players": players})
