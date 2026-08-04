Generic content container: 1px border, 12px radius, subtle hover fill. Compose with its subparts.

```jsx
<Card>
  <CardHeader>
    <CardTitle>API Keys</CardTitle>
    <CardDescription>Manage keys used to authenticate requests.</CardDescription>
  </CardHeader>
  <CardContent>…</CardContent>
  <CardFooter><Button>Create key</Button></CardFooter>
</Card>
```

Exports: `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`. For dashboard KPI tiles, prefer `StatCard` instead — it carries the accent-border treatment used throughout the console.
