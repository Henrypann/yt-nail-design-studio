import { Link } from 'react-router-dom';
import { Button, EmptyState } from '@/design-system';

/** `*` 404（PRD §6.3） */
export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas p-6" data-debug-id="app.not-found">
      <div className="w-full max-w-[480px]">
        <EmptyState
          title="页面未找到"
          description="你访问的页面不存在或已被移除。"
          action={
            <Link to="/">
              <Button size="sm">返回首页</Button>
            </Link>
          }
          className="min-h-[280px]"
        />
      </div>
    </div>
  );
}
