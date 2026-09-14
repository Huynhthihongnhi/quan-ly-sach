import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { Response } from 'express';
import { Public } from '../../common/http/decorators/public.decorator';
import { SessionRoute } from '../../common/http/decorators/session-route.decorator';
import { SkipResponseEnvelope } from '../../common/http/decorators/skip-response-envelope.decorator';
import { RequestWithContext } from '../../common/http/types/request-with-context';
import { AuthConfigService } from './auth-config.service';
import { AuthService } from './auth.service';
import { buildClearSessionCookie, buildSessionCookie } from './cookie.util';
import { ChallengeConsumptionService } from './challenge-consumption.service';
import { CompleteChallengeDto } from './dto/complete-challenge.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { PasswordRecoveryService } from './password-recovery.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly authConfig: AuthConfigService,
    private readonly passwordRecoveryService: PasswordRecoveryService,
    private readonly challengeConsumptionService: ChallengeConsumptionService,
  ) {}

  @Public()
  @HttpCode(202)
  @Post('forgot-password')
  async forgotPassword(@Body() body: ForgotPasswordDto, @Req() req: RequestWithContext) {
    return this.passwordRecoveryService.requestForgotPassword({
      email: body.email,
      clientIp: req.ip ?? 'unknown',
    });
  }

  @Public()
  @SkipResponseEnvelope()
  @HttpCode(204)
  @Post('reset-password')
  async resetPassword(@Body() body: CompleteChallengeDto, @Req() req: RequestWithContext) {
    await this.challengeConsumptionService.completeResetPassword({
      token: body.token,
      newPassword: body.newPassword,
      requestId: req.requestId,
    });
  }

  @Public()
  @SkipResponseEnvelope()
  @HttpCode(204)
  @Post('activate')
  async activate(@Body() body: CompleteChallengeDto, @Req() req: RequestWithContext) {
    await this.challengeConsumptionService.completeActivation({
      token: body.token,
      newPassword: body.newPassword,
      requestId: req.requestId,
    });
  }

  @Public()
  @HttpCode(200)
  @Post('login')
  async login(
    @Body() body: LoginDto,
    @Req() req: RequestWithContext,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login({
      email: body.email,
      password: body.password,
      requestId: req.requestId,
      clientIp: req.ip ?? 'unknown',
    });

    res.setHeader(
      'Set-Cookie',
      buildSessionCookie(
        this.authConfig.sessionCookieName,
        result.sessionToken,
        this.authConfig.sessionAbsoluteTtlMs,
        this.authConfig.isProduction,
      ),
    );

    return {
      user: result.user,
      csrfToken: result.csrfToken,
    };
  }

  @SessionRoute()
  @Get('me')
  me(@Req() req: RequestWithContext) {
    return {
      userId: req.actor?.userId,
      permissionCodes: req.actor?.permissionCodes ?? [],
    };
  }

  @SessionRoute()
  @Get('csrf')
  csrf(@Req() req: RequestWithContext, @Res({ passthrough: true }) res: Response) {
    res.setHeader('Cache-Control', 'no-store');
    return { csrfToken: req.sessionContext?.csrfToken ?? null };
  }

  @SessionRoute()
  @SkipResponseEnvelope()
  @HttpCode(204)
  @Post('logout')
  async logout(@Req() req: RequestWithContext, @Res({ passthrough: true }) res: Response) {
    if (req.sessionContext && req.actor) {
      await this.authService.logout({
        sessionId: req.sessionContext.sessionId,
        userId: req.actor.userId,
        requestId: req.requestId,
      });
    }

    res.setHeader(
      'Set-Cookie',
      buildClearSessionCookie(this.authConfig.sessionCookieName, this.authConfig.isProduction),
    );
  }
}
