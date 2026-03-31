export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-primary mb-4">
            <span className="text-primary-foreground font-semibold text-sm">A</span>
          </div>
          <h1 className="text-xl font-semibold text-foreground">Aria</h1>
          <p className="text-sm text-muted-foreground mt-1">AI Meeting Intelligence</p>
        </div>
        {children}
      </div>
    </div>
  )
}
