import { Link } from 'react-router-dom'
import { useStatusPages, useDeleteStatusPage } from '../hooks/useStatusPages'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import toast from 'react-hot-toast'

export default function StatusPagesList() {
  useDocumentTitle('Status pages · DronWatch')
  const { data: pages, isLoading } = useStatusPages()
  const remove = useDeleteStatusPage()

  const copyLink = (slug: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/status/${slug}`)
    toast.success('Link copied to clipboard')
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-surface-50">Status pages</h1>
          <p className="text-sm text-surface-500 mt-0.5">Public pages for your users</p>
        </div>
        <Link to="/dashboard/status-pages/new" className="btn-primary">New page</Link>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(2)].map((_, i) => <div key={i} className="card animate-pulse h-20 bg-surface-800" />)}
        </div>
      ) : pages?.length === 0 ? (
        <div className="card text-center py-16">
          <p className="text-surface-400 mb-4">No status pages yet.</p>
          <Link to="/dashboard/status-pages/new" className="btn-primary">Create your first status page</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {pages?.map(page => (
            <div key={page.id} className="card flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-surface-100">{page.name}</p>
                  <span className={page.is_public
                    ? 'inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                    : 'inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border border-surface-700 bg-surface-800 text-surface-400'}>
                    {page.is_public ? 'Public' : 'Private'}
                  </span>
                </div>
                <a
                  href={`/status/${page.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-mono text-brand-400 hover:text-brand-300 transition-colors"
                >
                  /status/{page.slug}
                </a>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => copyLink(page.slug)}
                  className="btn-ghost text-sm whitespace-nowrap"
                  title={page.is_public ? 'Copy public link' : 'Private — only you can view'}
                >
                  Copy link
                </button>
                <Link to={`/dashboard/status-pages/${page.id}/edit`} className="btn-ghost text-sm">Edit</Link>
                <button
                  onClick={() => confirm(`Delete "${page.name}"?`) && remove.mutate(page.id)}
                  disabled={remove.isPending}
                  className="btn-ghost text-sm text-red-400 hover:text-red-300 hover:bg-red-900/20"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
