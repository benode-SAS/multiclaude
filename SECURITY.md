# Security

## Reporting a vulnerability

Write to benjamin@benode.fr rather than opening a public issue. Expect an answer within a
few days.

## Threat model

multiclaude runs code on the host machine: that is its reason to exist. The following is
**by design**, and therefore not a vulnerability:

- An authenticated member can have the agent run commands, inside a conversation's working
  directory.
- The HTML preview executes the JavaScript of the rendered document, in an iframe without
  `allow-same-origin`: opaque origin, no access to the app or the API.

What we do want to hear about: authentication bypass, access to an instance's data from an
unauthorised account, escaping the preview sandbox, reading files outside the working
directory through the file routes, and anything that acts without going through the human
permission gate.

## Deploying without getting hurt

- Do not run the server as `root`.
- Close signups (`SIGNUP_ENABLED=false`) as soon as the instance is reachable from the
  internet.
- `ALWAYS_ASK_TOOLS=Bash` to have every command confirmed.
- Serve over HTTPS: the session cookie then becomes `secure` on its own.
