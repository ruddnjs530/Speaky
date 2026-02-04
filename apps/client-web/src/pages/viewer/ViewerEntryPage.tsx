import { useNavigate } from 'react-router-dom';
import Card from '../../shared/ui/Card';
import Input from '../../shared/ui/Input';
import Button from '../../shared/ui/Button';
import { useState } from 'react';
import { useAuthRedirect } from '../../features/auth/lib/useAuthRedirect';
import { motion } from 'framer-motion';

export default function ViewerEntryPage() {
    const navigate = useNavigate();
    const [channelIdInput, setChannelIdInput] = useState('');
    const [error, setError] = useState('');

    useAuthRedirect();

    const handleJoinChannel = () => {
        if (!channelIdInput.trim()) {
            setError('참여하실 채널 ID를 입력해주세요.');
            return;
        }
        navigate(`/viewer/${channelIdInput.trim()}`);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50 p-4 font-sans">
            <div className="w-full max-w-md space-y-8 -mt-16">

                {/* 헤더 / 배너 */}
                <motion.div
                    className="text-center space-y-4"
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                >
                    <motion.div
                        className="inline-block bg-orange-50 border border-orange-200 rounded-full px-6 py-2"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5, delay: 0.4 }}
                    >
                        <span className="text-[#E8753A] font-medium text-sm">
                            ⚠️ 이 방송에서는 AI로 변조된 음성이 송출됩니다
                        </span>
                    </motion.div>

                    <h1 className="text-3xl font-bold text-gray-900">뷰어 입장</h1>
                    <p className="text-gray-500">시청할 채널 ID를 입력해주세요.</p>
                </motion.div>

                {/* 입력 카드 */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.3 }}
                >
                    <Card className="p-8 shadow-lg border-0">
                        <div className="space-y-6">
                            <motion.div
                                className="space-y-2"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.5, delay: 0.5 }}
                            >
                                <Input
                                    label="채널 ID (Host ID)"
                                    placeholder="예: ch_user_1"
                                    value={channelIdInput}
                                    error={error}
                                    onChange={(e) => {
                                        setChannelIdInput(e.target.value);
                                        if (error) setError('');
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleJoinChannel();
                                    }}
                                />
                            </motion.div>

                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.5, delay: 0.6 }}
                            >
                                <Button
                                    onClick={handleJoinChannel}
                                    variant="primary"
                                    className="w-full text-lg font-bold py-3"
                                >
                                    입장하기
                                </Button>
                            </motion.div>

                            <motion.div
                                className="text-center"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ duration: 0.5, delay: 0.7 }}
                            >
                                <button
                                    onClick={() => navigate('/')}
                                    className="text-gray-500 text-sm hover:text-gray-700 underline"
                                >
                                    홈으로 돌아가기
                                </button>
                            </motion.div>
                        </div>
                    </Card>
                </motion.div>

            </div>
        </div>
    );
}
