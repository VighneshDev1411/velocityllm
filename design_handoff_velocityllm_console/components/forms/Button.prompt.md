The default clickable action control across VelocityLLM — dashboards, forms, dialogs, and the marketing site all use it.

```jsx
<Button variant="default" size="default" onClick={() => {}}>Save changes</Button>
<Button variant="outline" size="sm"><Icon name="refresh-cw" size={14}/> Retry</Button>
```

Variants: `default` (solid periwinkle, on dark surfaces), `secondary` (solid green), `destructive` (solid red, for delete/danger), `outline` (transparent + border, hover fills with the surface-hover tint), `ghost` (no border, hover fill only), `link` (text-only, underlines on hover). Sizes: `default` (36px), `sm` (32px), `lg` (40px), `icon` (36×36 square, no label — pair with an `Icon`). Buttons scale to 0.95 on press for tactile feedback; disabled buttons drop to 50% opacity and block pointer events.
