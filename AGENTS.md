<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep pose smoothing, aspect-corrected measurements, and rep validation in the browser-safe push-up logic module so the camera and regression tests share identical biomechanics.
- Derive ranks and achievements from saved workout history in the pure progress module so the home page and tests share the same rules; never store them separately.
- Each exercise keeps its rep/form logic in its own pure module (pushup.ts, squat.ts, plank.ts) and plugs into the shared ExerciseTracker via a config object, so camera, HUD, voice and saving stay identical across exercises.
- Optional accounts use one root AccountProvider; browser Data API requests use owner-only RLS, account-scoped history caches and durable pending queues with deletion tombstones to avoid cross-account leaks and resurrected workouts. Guest history is imported only by explicit user action.
