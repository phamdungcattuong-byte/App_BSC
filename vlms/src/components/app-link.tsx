import type { AnchorHTMLAttributes } from 'react';

/**
 * Liên kết trong ứng dụng, dùng điều hướng thường của trình duyệt.
 *
 * Ứng dụng này là công cụ xử lý chứng từ: mọi màn hình đều dựng theo phiên đăng
 * nhập nên không có trang nào nằm sẵn trong bộ nhớ đệm, và mỗi thao tác đều đổi
 * trạng thái chứng từ. Điều hướng phía client của App Router vì thế không tiết
 * kiệm được gì, trong khi có lúc nó tải xong dữ liệu trang mới mà không vẽ ra,
 * để người dùng bấm vào liên kết rồi ngồi nhìn màn hình cũ. Tải cả trang thì
 * luôn hiển thị đúng dữ liệu mới nhất và không bao giờ kẹt.
 *
 * Giữ nguyên tên `Link` khi nhập khẩu để phần JSX của các trang không phải sửa.
 */
export function AppLink({
  href,
  children,
  ...rest
}: { href: string } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>) {
  return (
    <a href={href} {...rest}>
      {children}
    </a>
  );
}
