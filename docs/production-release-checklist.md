# Production Release Checklist — BloomPro Studio (Florist)

A release is only "done" when it is **traceable**: a clean git state, a passing
verification gate, and a tag. No "almost released" states.

## 1. Pre-flight (working tree)

- [ ] `git status` is clean except intentionally-untracked local debug files
- [ ] No `scratch/*` debug scripts staged (they are gitignored)
- [ ] No `.env` or any credential-bearing file staged
- [ ] `.env.example` contains **placeholders only**
- [ ] `package.json` `version` matches the intended release (e.g. `1.6.1`)

## 2. Verification gate

Run the single command:

```bash
npm run verify:prod
```

which runs, in order:

| Step | Command | Gate |
|------|---------|------|
| Lint | `npm run lint` | 0 errors |
| Build | `npm run build` (`tsc -b && vite build`) | exit 0 |
| Reconciliation logic | `npm run test-reconciliation` | all pass |
| Firestore security rules | `npm run test-rules` | all boundaries enforced |
| Authenticated smoke | `npm run smoke:auth` | 7/7 pass (or **skips** if `SMOKE_AUTH_*` unset) |

> The authenticated smoke needs a dedicated test account in `.env`
> (`SMOKE_AUTH_EMAIL` / `SMOKE_AUTH_PASSWORD`). See
> [docs/smoke-auth.md](./smoke-auth.md). Without credentials it skips cleanly,
> so `verify:prod` never blocks on a missing local secret — but a real release
> should run it green.

## 3. Manual confirmation (owner)

- [ ] Authenticated 7-step smoke confirmed (manual or `smoke:auth` green)
- [ ] Dashboard renders; company context resolves to a valid company
- [ ] No console error flood; no error boundary
- [ ] In-app build label (sidebar footer) shows the expected version + hash

## 4. Deploy

```bash
firebase deploy --only firestore:rules,hosting --project florist-d5026
```

- [ ] Rules compiled successfully
- [ ] Hosting release complete; live URL serves the new build hash

> **Firebase Storage deploy gate.** Storage rules are managed by `storage.rules`
> and currently **deny all reads/writes** because the app has no active Storage
> features. The `firebase deploy --only firestore:rules,hosting` command above
> does **not** deploy Storage rules. Before any production release involving
> Firebase Storage, confirm whether the live bucket rules have been deployed with:
>
> ```bash
> firebase deploy --only storage --project florist-d5026
> ```
>
> Until that deploy occurs, the live bucket may still be using its previous
> rules — the managed deny-all in `storage.rules` is not yet in effect on the
> live bucket.

- [ ] If Storage is in scope for this release, `firebase deploy --only storage` has been run and the live bucket reflects `storage.rules`

## 5. Tag the release

Only **after** the gate is green and smoke is confirmed:

```bash
git push origin main
git tag -a vX.Y.Z-<slug> -m "<summary>"
git push origin vX.Y.Z-<slug>
```

- [ ] `git tag --points-at HEAD` shows the new tag
- [ ] `git ls-remote --tags origin vX.Y.Z-<slug>` confirms it on origin

## 6. Post-release

- [ ] Record the release in the changelog / release notes
- [ ] Confirm the deployed `__BUILD_HASH__` matches the tagged commit
- [ ] Roll-back plan noted (previous tag + `firebase hosting:rollback` if needed)

---

### Rules of engagement (carried from recent stability work)

- Never weaken Firestore rules to make a test pass.
- Never commit `scratch/*`, `.env`, service-account keys, or test passwords.
- Membership/company access is provisioned via
  `scripts/bootstrap-default-company-user.js` (Admin SDK), never client-side.
- Prefer small, focused commits; run `verify:prod` before tagging.
