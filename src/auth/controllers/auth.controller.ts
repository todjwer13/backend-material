import { Body, Controller, Post, Req } from '@nestjs/common';
import { AuthService, UserService } from '../services';
import {
  CreateUserDto,
  LoginReqDto,
  LoginResDto,
  RefreshReqDto,
  SignupResDto,
} from '../dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly userService: UserService,
  ) {}

  // 로그인 처리, 사용자 인증
  @Post('login')
  async login(
    @Req() req,
    @Body() loginReqDto: LoginReqDto,
  ): Promise<LoginResDto> {
    const { ip, method, originalUrl } = req;
    const reqInfo = {
      ip,
      endpoint: `${method} ${originalUrl}`,
      ua: req.headers['user-agent'] || '',
    };

    return this.authService.login(
      loginReqDto.email,
      loginReqDto.password,
      reqInfo,
    );
  }

  // 새로운 사용자 등록, 사용자의 정보 반환
  @Post('signup')
  async signup(@Body() createUserDto: CreateUserDto): Promise<SignupResDto> {
    const user = await this.userService.createUser(createUserDto);
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
    };
  }

  // 토큰을 새로 발급
  @Post('refresh')
  async refresh(@Body() dto: RefreshReqDto): Promise<string> {
    return this.authService.refreshAccessToken(dto.refreshToken);
  }
}
