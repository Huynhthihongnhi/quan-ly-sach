import { Profile } from '../../identity/entities/profile.entity';
import { User } from '../../identity/entities/user.entity';

export interface UserResponse {
  id: string;
  email: string;
  status: string;
  version: string;
  createdAt: string;
}

export interface ProfileResponse {
  userId: string;
  displayName: string;
  phone: string | null;
  version: string;
}

export function toUserResponse(user: User): UserResponse {
  return {
    id: user.id,
    email: user.email,
    status: user.status,
    version: user.version,
    createdAt: user.createdAt.toISOString(),
  };
}

export function toProfileResponse(profile: Profile): ProfileResponse {
  return {
    userId: profile.userId,
    displayName: profile.displayName,
    phone: profile.phone,
    version: profile.version,
  };
}
