'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';

export interface FormState {
  error?: string;
  ok?: string;
  redirectTo?: string;
}

/**
 * Bọc một Server Action kèm hiển thị lỗi và trạng thái đang gửi.
 *
 * Vòng đời được điều khiển tường minh thay vì dựa vào useActionState:
 *
 *   1. Chặn gửi khi React chưa hydrate. Nếu người dùng kịp bấm trong khoảng
 *      trang đã hiện nhưng chưa gắn sự kiện, trình duyệt gửi form theo kiểu
 *      native; hydrate chen vào giữa sẽ hủy điều hướng và nút kẹt vĩnh viễn.
 *
 *   2. Sau khi action chạy xong thì điều hướng bằng cách tải lại cả trang, chứ
 *      không dùng router phía client. Trong phiên đã từng gọi Server Action,
 *      các lần chuyển trang bằng router sau đó thỉnh thoảng nhận đủ dữ liệu
 *      trang mới nhưng không bao giờ vẽ ra: nút vẫn kẹt ở trạng thái đang gửi
 *      dù dữ liệu đã ghi xong. Tải cả trang thì luôn dựng lại từ máy chủ, đúng
 *      với tính chất của ứng dụng chứng từ này, nơi mỗi thao tác đều đổi trạng
 *      thái và cần dữ liệu mới nhất.
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
  const [busy, setBusy] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Không đụng vào state sau khi component đã rời khỏi cây.
  const mounted = useRef(true);
  useEffect(() => {
    setHydrated(true);
    return () => {
      mounted.current = false;
    };
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    const form = event.currentTarget;
    const formData = new FormData(form);

    // Nút submit mang name/value (ví dụ decision=APPROVE) không tự vào FormData
    // khi gửi bằng JavaScript, phải lấy từ phần tử đang được kích hoạt.
    const submitter = (event.nativeEvent as SubmitEvent).submitter as
      | HTMLButtonElement
      | undefined;
    if (submitter?.name) formData.set(submitter.name, submitter.value);

    setBusy(true);
    setState({});

    action({}, formData).then(
      (result) => {
        if (!mounted.current) return;
        if (result.redirectTo) {
          // Giữ nguyên trạng thái đang gửi cho tới khi trang mới hiện ra.
          window.location.assign(result.redirectTo);
          return;
        }
        setState(result);
        setBusy(false);
      },
      (error: unknown) => {
        if (!mounted.current) return;
        setState({ error: error instanceof Error ? error.message : 'Có lỗi xảy ra.' });
        setBusy(false);
      },
    );
  }

  return (
    <form onSubmit={handleSubmit} className={className} data-hydrated={hydrated}>
      {children(busy || !hydrated)}
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
