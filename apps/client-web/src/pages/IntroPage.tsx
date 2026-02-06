import { IntroLayout } from "../features/intro/IntroLayout";
import { HeroSection } from "../features/intro/ui/HeroSection";
import { FeatureSection } from "../features/intro/ui/FeatureSection";
import { TeamSection } from "../features/intro/ui/TeamSection";

export default function IntroPage() {
    return (
        <IntroLayout>
            <HeroSection />
            <FeatureSection />
            <TeamSection />
        </IntroLayout>
    );
}
