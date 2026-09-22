import { CONFIG } from 'src/global-config';

import { resetPassword } from 'src/auth/context/jwt';
import { JwtUpdatePasswordView } from 'src/auth/view/jwt';

// ----------------------------------------------------------------------

const metadata = { title: `Đặt lại mật khẩu | ${CONFIG.appName}` };

export default function Page() {
  return (
    <>
      <title>{metadata.title}</title>

      <JwtUpdatePasswordView
        title="Đặt lại mật khẩu"
        description="Nhập mật khẩu mới cho tài khoản của bạn."
        submitLabel="Đặt lại mật khẩu"
        successMessage="Đặt lại mật khẩu thành công. Bạn có thể đăng nhập bằng mật khẩu mới."
        complete={resetPassword}
      />
    </>
  );
}
