'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { verifyPassword } from '@/lib/password';
import { setSessionCookie, clearSessionCookie } from '@/lib/session';

const schema = z.object({
  email: z.string().email('Email không hợp lệ.'),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu.'),
});

export interface LoginState {
  error?: string;
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = schema.safeParse({
    email: String(formData.get('email') ?? '').trim().toLowerCase(),
    password: String(formData.get('password') ?? ''),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });

  // Không tiết lộ tài khoản có tồn tại hay không.
  if (!user || !user.isActive || !verifyPassword(parsed.data.password, user.passwordHash)) {
    return { error: 'Email hoặc mật khẩu không đúng.' };
  }

  await setSessionCookie(user.id, user.role);
  // Xóa router cache phía client để không còn sót dữ liệu của phiên trước.
  revalidatePath('/', 'layout');
  redirect('/bang-dieu-khien');
}

export async function logout(): Promise<void> {
  await clearSessionCookie();
  // Bắt buộc: router cache của Next giữ lại cây RSC đã render. Nếu không xóa,
  // người đăng nhập sau trên cùng trình duyệt có thể thấy dữ liệu của người trước.
  revalidatePath('/', 'layout');
  redirect('/dang-nhap');
}
