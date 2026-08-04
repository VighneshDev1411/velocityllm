Loading placeholder — size it to match the content it stands in for.

```jsx
<Skeleton style={{ width: 160, height: 20 }} />
<Skeleton style={{ width: '100%', height: 120, borderRadius: 8 }} />
```

Requires the `@keyframes ds-skeleton-pulse` rule (opacity 1 ↔ 0.5) to be present on the page — every card/UI kit in this system defines it in a small inline `<style>` block since the DS ships no global stylesheet beyond tokens.
