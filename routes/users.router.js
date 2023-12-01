import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../src/utils/prisma/index.js';
import authMiddleware from '../src/middlewares/auth.middleware.js';

const router = express.Router();

// 사용자 회원가입 API
router.post('/sign-up', async (req, res, next) => {
    try {
        //throw new Error('에러 처리 미들웨어 테스트 중 입니다.');

        // 1. `email`, `password`, `name`, `age`, `gender`, `profileImage`를 **body**로 전달받습니다.
        const { email, password, name, age, gender, profileImage } = req.body;

        // 2. 동일한 `email`을 가진 사용자가 있는지 확인합니다.
        const isExistUser = await prisma.users.findFirst({
            where: { email },
        });

        if (isExistUser) {
            return res.status(409).json({ message: '이미 존재하는 이메일 입니다.' });
        }

        // 3. **Users** 테이블에 `email`, `password`를 이용해 사용자를 생성합니다.
        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await prisma.users.create({
            data: { email, password: hashedPassword },
        });

        // 4. **UserInfos** 테이블에 `name`, `age`, `gender`, `profileImage`를 이용해 사용자 정보를 생성합니다.
        const userInfo = await prisma.userInfos.create({
            data: {
                UserId: user.userId,
                name,
                age,
                gender: gender.toUpperCase(), // 전달받은 gender를 전부 대문자로 치환한다.
                profileImage,
            },
        });

        return res.status(201).json({ message: '회원가입이 완료되었습니다.' });
    } catch (err) {
        next(err);
    }
});

// 사용자 로그인 API
router.post('/sign-in', async (req, res, next) => {
    // 1. `email`, `password`를 **body**로 전달받습니다.
    const { email, password } = req.body;

    // 2. 전달 받은 `email`에 해당하는 사용자가 있는지 확인합니다.
    const user = await prisma.users.findFirst({ where: { email } });
    if (!user) {
        return res.status(401).json({ message: '존재하지 않는 이메일입니다.' });
    }

    // 3. 전달 받은 `password`와 데이터베이스의 저장된 `password`를 bcrypt를 이용해 검증합니다.
    if (!(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ message: '비밀번호가 일치하지 않습니다.' });
    }

    // 4. 로그인에 성공한다면, 사용자에게 JWT를 발급합니다.
    const token = jwt.sign(
        {
            userId: user.userId,
        },
        'customized_secret_key' //잠시 평문, 비밀 키, .dotenv를 이용해서, 외부엣서 코드를 보더라도, 알 수 없도록 구현해야합니다.
    );

    res.cookie('authorization', `Bearer ${token}`);
    return res.status(200).json({ message: '로그인에 성공했습니다.' });
});

// 사용자 조회 API
router.get('/users', authMiddleware, async (req, res, next) => {
    // 1. 클라이언트가 **로그인된 사용자인지 검증**합니다.
    const { userId } = req.user;

    // 2. 사용자를 조회할 때, 1:1 관계를 맺고 있는 **Users**와 **UserInfos** 테이블을 조회합니다.
    const user = await prisma.users.findFirst({
        where: { userId: +userId },
        // 특정 컬럼만 조회하는 파라미터
        select: {
            userId: true,
            email: true,
            createdAt: true,
            updatedAt: true,
            UserInfos: {
                select: {
                    name: true,
                    age: true,
                    gender: true,
                    profileImage: true,
                },
                where: {},
            },
        },
    });

    // 3. 조회한 사용자의 상세한 정보를 클라이언트에게 반환합니다.
    return res.status(200).json({ data: user });
});

export default router;