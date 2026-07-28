/**
 * PreToolUse hook, spawned by the `claude` CLI for every tool call.
 * Forwards the request to the server, which blocks until a human decides.
 */
type HookInput = { hook_event_name?: string; tool_name?: string; tool_input?: unknown }

const roomId = process.argv[2]
const server = process.env.MC_SERVER ?? 'http://localhost:3001'

function decide(allow: boolean, reason?: string): never {
	console.log(
		JSON.stringify({
			hookSpecificOutput: {
				hookEventName: 'PreToolUse',
				permissionDecision: allow ? 'allow' : 'deny',
				permissionDecisionReason: reason,
			},
		}),
	)
	process.exit(0)
}

const input = (await Bun.stdin.json().catch(() => null)) as HookInput | null

if (!roomId || input?.hook_event_name !== 'PreToolUse' || !input.tool_name) decide(true)

const response = await fetch(`${server}/internal/permission`, {
	method: 'POST',
	headers: { 'content-type': 'application/json' },
	body: JSON.stringify({ roomId, tool: input?.tool_name, input: input?.tool_input }),
}).catch(() => null)

if (!response?.ok) decide(true)

const decision = (await response.json()) as { allow: boolean; reason?: string }
decide(decision.allow, decision.reason)
