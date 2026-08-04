The console's primary navigation — collapses to an icon rail (72px) or expands to 260px with grouped section labels. Matches the real product's Main/Infrastructure/Admin grouping.

```jsx
<Sidebar
  activeHref="/dashboard"
  collapsed={collapsed}
  onToggleCollapse={() => setCollapsed(!collapsed)}
  sections={[
    { title: 'Main', links: [{ href: '/dashboard', label: 'Dashboard', icon: 'layout-dashboard' }] },
    { title: 'Infrastructure', links: [{ href: '/workers', label: 'Workers', icon: 'cpu' }] },
  ]}
/>
```

Active links get a 3px inset accent border and switch icon/text color to the primary accent.
