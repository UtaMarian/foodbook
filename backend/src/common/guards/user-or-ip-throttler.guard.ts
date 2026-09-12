import { ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import {
  InjectThrottlerOptions,
  InjectThrottlerStorage,
  ThrottlerGuard,
  type ThrottlerModuleOptions,
  type ThrottlerStorage,
} from '@nestjs/throttler';

interface RequestWithOptionalUser {
  ip: string;
  user?: { id: string };
}

/**
 * Foloseste id-ul utilizatorului autentificat cand exista (setat de
 * JwtAuthGuard, care ruleaza inaintea acestui guard) - altfel un IP
 * partajat (retea mobila, NAT de birou) ar limita gresit mai multi
 * utilizatori la un loc. Pentru rutele publice (ex. /auth/register)
 * ramane IP-ul, singurul semnal disponibil inainte de autentificare.
 *
 * Dezactivat in afara productiei: altfel o sesiune lunga de dezvoltare
 * (multe reporniri ale suitei e2e, care inregistreaza cateva conturi la
 * fiecare rulare) loveste pragul de 5 inregistrari/ora si blocheaza
 * fluxul de lucru. Pe Render (NODE_ENV=production) ramane activ.
 */
@Injectable()
export class UserOrIpThrottlerGuard extends ThrottlerGuard {
  constructor(
    @InjectThrottlerOptions() options: ThrottlerModuleOptions,
    @InjectThrottlerStorage() storageService: ThrottlerStorage,
    reflector: Reflector,
    private readonly config: ConfigService,
  ) {
    super(options, storageService, reflector);
  }

  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    if (this.config.get<string>('NODE_ENV') !== 'production') return true;
    return super.shouldSkip(context);
  }

  protected async getTracker(req: RequestWithOptionalUser): Promise<string> {
    return req.user?.id ? `user:${req.user.id}` : `ip:${req.ip}`;
  }
}
