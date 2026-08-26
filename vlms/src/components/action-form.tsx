'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition, type FormEvent } from 'react';

export interface FormState {
  error?: string;
  ok?: string;
  redirectTo?: string;
}

/**
 * Bọc một Server Action kèm hiển thị lỗi và trạng thái đang gửi.
 *
 * Vòng đời được điều khiển tường minh thay vì dựa vào useActionState:
 *   1. Chặn gửi khi React chưa hydrate. Nếu người dùng kịp bấm trong khoảng
 *      trang đã hiện nhưng chưa gắn sự kiện, trình duyệt gửi form theo kiểu
 *      native; hydrate chen vào giữa sẽ hủy điều hướng và nút kẹt vĩnh viễn.
 *   2. Chờ action trả kết quả, cập nhật thông báo, RỒI mới router.refresh().
 *      Làm mới trong lúc transition chưa kết thúc khiến cây render bị dựng lại
 *      giữa chừng và trạng thái đang gửi không bao giờ được gỡ.
 */
export function ActionForm({
  action,
  children,
  className,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  children: (disabled: boolean) => React.ReactNode;
  className?: string;
}) {
  const [state, setState] = useState<FormState>({});
  const [pending, startTransition] = useTransition();
  const [hydrated, setHydrated] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const router = useRouter();

  useEffect(() => setHydrated(true), []);

  // Điều hướng nằm NGOÀI transition của form. Gọi bên trong khiến transition chỉ
  // kết thúc khi điều hướng xong và nút đứng mãi ở trạng thái đang gửi.
  useEffect(() => {
    if (state.redirectTo) {
      setNavigating(true);
      router.push(state.redirectTo);
    }
  }, [state.redirectTo, router]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    // Nút submit mang name/value (ví dụ decision=APPROVE) không tự vào FormData
    // khi gửi bằng JavaScript, phải lấy từ phần tử đang được kích hoạt.
    const submitter = (event.nativeEvent as SubmitEvent).submitter as
      | HTMLButtonElement
      | undefined;
    if (submitter?.name) formData.set(submitter.name, submitter.value);

    startTransition(async () => {
      const result = await action({}, formData);
      setState(result);
    });
  }

  return (
    <form onSubmit={handleSubmit} className={className} data-hydrated={hydrated}>
      {children(pending || navigating || !hydrated)}
      {state.error ? (
        <p role="alert" className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p role="status" className="mt-2 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {state.ok}
        </p>
      ) : null}
    </form>
  );
}

/** Cùng cơ chế chống bấm sớm, dùng cho form tự quản lý trạng thái gửi. */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}
