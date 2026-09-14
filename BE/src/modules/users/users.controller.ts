import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { RequirePermissions } from '../../common/http/decorators/require-permissions.decorator';
import { SessionRoute } from '../../common/http/decorators/session-route.decorator';
import { RequestWithContext } from '../../common/http/types/request-with-context';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UserListQueryDto } from './dto/user-list-query.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @RequirePermissions('users.read')
  @Get()
  @ApiOperation({ summary: 'List users with pagination' })
  listUsers(@Query() query: UserListQueryDto) {
    return this.usersService.listUsers(query);
  }

  @RequirePermissions('users.write')
  @Post()
  @ApiOperation({ summary: 'Create invited user with profile' })
  async createUser(
    @Body() body: CreateUserDto,
    @Req() req: RequestWithContext,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.usersService.createUser(body, req.actor!.userId, req.requestId);
    res.status(201);
    res.setHeader('Location', `/api/v1/users/${user.id}`);
    return user;
  }

  @RequirePermissions('users.read')
  @Get(':id')
  @ApiOperation({ summary: 'Get user by id' })
  getUser(@Param('id') id: string) {
    return this.usersService.getUser(id);
  }

  @RequirePermissions('users.write')
  @HttpCode(202)
  @Post(':id/activation-email')
  @ApiOperation({ summary: 'Send activation email to invited user' })
  sendActivationEmail(@Param('id') id: string, @Req() req: RequestWithContext) {
    return this.usersService.sendActivationEmail(id, req.actor!.userId, req.requestId);
  }

  @RequirePermissions('users.write')
  @Patch(':id/status')
  @ApiOperation({ summary: 'Update user status' })
  updateUserStatus(
    @Param('id') id: string,
    @Body() body: UpdateUserStatusDto,
    @Req() req: RequestWithContext,
  ) {
    return this.usersService.updateUserStatus(id, body, req.actor!.userId, req.requestId);
  }

  @RequirePermissions('profiles.read')
  @Get(':id/profile')
  @ApiOperation({ summary: 'Get profile for a user' })
  getUserProfile(@Param('id') id: string) {
    return this.usersService.getUserProfile(id);
  }

  @RequirePermissions('profiles.write')
  @Patch(':id/profile')
  @ApiOperation({ summary: 'Update profile for a user' })
  updateUserProfile(
    @Param('id') id: string,
    @Body() body: UpdateProfileDto,
    @Req() req: RequestWithContext,
  ) {
    return this.usersService.updateUserProfile(id, body, req.actor!.userId, req.requestId);
  }
}

@ApiTags('me')
@Controller('me')
export class MeProfileController {
  constructor(private readonly usersService: UsersService) {}

  @SessionRoute()
  @Get('profile')
  @ApiOperation({ summary: 'Get own profile' })
  getOwnProfile(@Req() req: RequestWithContext) {
    return this.usersService.getOwnProfile(req.actor!.userId);
  }

  @SessionRoute()
  @Patch('profile')
  @ApiOperation({ summary: 'Update own profile' })
  updateOwnProfile(@Body() body: UpdateProfileDto, @Req() req: RequestWithContext) {
    return this.usersService.updateOwnProfile(req.actor!.userId, body, req.requestId);
  }
}
