import { CONFIG } from 'src/global-config';

import { activateAccount } from 'src/auth/context/jwt';
import { JwtUpdatePasswordView } from 'src/auth/view/jwt';

// ----------------------------------------------------------------------

const metadata = { title: `Kích hoạt tài khoản | ${CONFIG.appName}` };

export default function Page() {
  return (
    <>
      <title>{metadata.title}</title>

      <JwtUpdatePasswordView
        title="Kích hoạt tài khoản"
        description="Đặt mật khẩu để kích hoạt tài khoản của bạn."
        submitLabel="Kích hoạt"
        successMessage="Kích hoạt tài khoản thành công. Bạn có thể đăng nhập ngay."
        complete={activateAccount}
      />
    </>
  );
}
