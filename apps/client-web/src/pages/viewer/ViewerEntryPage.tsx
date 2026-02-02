import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../../shared/ui/Card';
import Input from '../../shared/ui/Input';
import Button from '../../shared/ui/Button';

export default function ViewerEntryPage() {
    const navigate = useNavigate();
    const [channelIdInput, setChannelIdInput] = useState('');

    const handleJoinChannel = () => {
        if (!channelIdInput.trim()) {
            alert('채널 ID를 입력해주세요.');
            return;
        }
        navigate(`/viewer/${channelIdInput.trim()}`);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4 font-sans">
            <div className="w-full max-w-md space-y-8">

                {/* Header / Banner */}
                <div className="text-center space-y-4">
                    <div className="inline-block bg-orange-50 border border-orange-200 rounded-full px-6 py-2">
                        <span className="text-[#E8753A] font-medium text-sm">
                            ⚠️ 이 방송에서는 AI로 변조된 음성이 송출됩니다
                        </span>
                    </div>

                    <h1 className="text-3xl font-bold text-gray-900">뷰어 입장</h1>
                    <p className="text-gray-500">시청할 채널 ID를 입력해주세요.</p>
                </div>

                {/* Input Card */}
                <Card className="p-8 shadow-lg border-0">
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <Input
                                label="채널 ID (Host ID)"
                                placeholder="예: ch_user_1"
                                value={channelIdInput}
                                onChange={(e) => setChannelIdInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleJoinChannel();
                                }}
                            />
                        </div>

                        <Button
                            onClick={handleJoinChannel}
                            variant="primary"
                            className="w-full text-lg font-bold py-3"
                        >
                            입장하기
                        </Button>

                        <div className="text-center">
                            <button
                                onClick={() => navigate('/')}
                                className="text-gray-400 text-sm hover:text-gray-600 underline"
                            >
                                홈으로 돌아가기
                            </button>
                        </div>
                    </div>
                </Card>

            </div>
        </div>
    );
}
