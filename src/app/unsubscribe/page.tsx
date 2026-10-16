export default function UnsubscribePage({ searchParams }: { searchParams: { token?: string } }) {
  const token = searchParams?.token;
  return (
    <div className="container" style={{ maxWidth: 520, padding: '64px 20px' }}>
      <div className="card">
        <h1 style={{ marginTop: 0 }}>Unsubscribe</h1>
        {token ? (
          <>
            <p>Confirm that you want to stop receiving marketing emails from this sender.</p>
            <form action="/api/unsubscribe" method="post">
              <input type="hidden" name="token" value={token} />
              <button className="btn btn-primary" type="submit">Confirm unsubscribe</button>
            </form>
          </>
        ) : (
          <p style={{ color: '#64748B' }}>Missing token. Use the unsubscribe link in the email you received.</p>
        )}
      </div>
    </div>
  );
}
