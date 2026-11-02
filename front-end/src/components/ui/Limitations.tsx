export function Limitations({ items }: { items: string[] }) {
  return (
    <section className="panel limitations">
      <div className="panel-heading">
        <div>
          <p className="section-kicker">Context</p>
          <h2>Limitations</h2>
        </div>
      </div>

      {items.length ? (
        <ul>
          {items.map((item, index) => (
            <li key={`${item}-${index}`}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="muted-copy">No limitations were returned.</p>
      )}
    </section>
  )
}
