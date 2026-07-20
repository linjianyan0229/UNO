import type { ClientToServerEvents, ClientUserEvents } from 'types/server';
import { registerAccount, loginAccount, loginByToken, updateAccount } from '../services/user';
import { send } from './room';

const userControllers: Pick<ClientToServerEvents, ClientUserEvents> = {
  REGISTER: async (data, ws) => {
    const result = await registerAccount(data?.name, data?.password);
    send(ws, {
      message: result.ok ? '注册成功' : result.message,
      data: result.ok ? result.profile : null,
      type: 'RES_REGISTER'
    });
  },
  LOGIN: async (data, ws) => {
    const result = await loginAccount(data?.name, data?.password);
    send(ws, {
      message: result.ok ? '登录成功' : result.message,
      data: result.ok ? result.profile : null,
      type: 'RES_LOGIN'
    });
  },
  AUTO_LOGIN: async (data, ws) => {
    const result = await loginByToken(data?.token);
    send(ws, {
      data: result.ok ? result.profile : null,
      type: 'RES_AUTO_LOGIN'
    });
  },
  UPDATE_PROFILE: async (data, ws) => {
    const result = await updateAccount(data?.token, data?.name, data?.avatar);
    send(ws, {
      message: result.ok ? '资料已更新' : result.message,
      data: result.ok ? result.profile : null,
      type: 'RES_UPDATE_PROFILE'
    });
  }
};

export default userControllers;
