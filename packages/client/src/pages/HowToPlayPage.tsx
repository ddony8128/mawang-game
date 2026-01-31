import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Crown,
  Skull,
  Shield,
  Heart,
  Swords,
  Search,
  Bomb,
  Beer,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

export function HowToPlayPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-dark flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-md border-b border-border/50 p-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          뒤로가기
        </Button>
      </header>

      <ScrollArea className="flex-1">
        <div className="p-6 max-w-2xl mx-auto space-y-8 pb-20">
          {/* Title */}
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-black text-gradient-gold">
              게임하는 법
            </h1>
            <p className="text-muted-foreground">마(피아)왕 게임 규칙 안내</p>
          </div>

          {/* 개요 */}
          <Section title="🎮 게임 개요">
            <ul className="space-y-2 text-sm">
              <li>• 플레이 인원: 6~10명</li>
              <li>• 플레이 방식: 실시간</li>
              <li>• 예상 시간: 20~30분</li>
              <li>• 장르: 소셜 추리 + 카드 액션</li>
            </ul>
          </Section>

          {/* 승리 조건 */}
          <Section title="🏆 승리 조건">
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-good/10 border border-good/30">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="w-5 h-5 text-good" />
                  <h4 className="font-bold text-good">선 팀 승리</h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  마왕이 사망하면 용사 + 시민이 승리합니다.
                </p>
              </div>
              <div className="p-4 rounded-lg bg-evil/10 border border-evil/30">
                <div className="flex items-center gap-2 mb-2">
                  <Skull className="w-5 h-5 text-evil" />
                  <h4 className="font-bold text-evil">악 팀 승리</h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  모든 용사가 사망하면 마왕 + 배신자가 승리합니다.
                </p>
              </div>
            </div>
          </Section>

          {/* 생명력 */}
          <Section title="❤️ 생명력 (HP)">
            <div className="flex items-center gap-2 mb-3">
              {[1, 2, 3].map((i) => (
                <Heart
                  key={i}
                  className="w-6 h-6 text-primary fill-primary"
                />
              ))}
            </div>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• 모든 플레이어는 기본 생명력 3</li>
              <li>• 생명력이 0이 되면 즉시 사망</li>
              <li>• 사망 시 카드/능력/행동 불가</li>
              <li>• 모든 플레이어의 현재 생명력은 공개 정보</li>
            </ul>
          </Section>

          {/* 카드 시스템 */}
          <Section title="🃏 카드 시스템">
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground mb-4">
              <p>• 게임 시작 시 카드 1장 획득</p>
              <p>• 이후 2분마다 카드 1장 획득</p>
              <p>• 손패 제한: 최대 4장</p>
            </div>

              <div className="grid grid-cols-2 gap-3">
                <CardInfo
                  icon={<Search className="w-5 h-5" />}
                  name="돋보기"
                  color="bg-card-magnifier/20 border-card-magnifier/50"
                  description="2장: 선/악 팀 확인, 3장: 정확한 역할 확인"
                />
                <CardInfo
                  icon={<Swords className="w-5 h-5" />}
                  name="칼"
                  color="bg-card-sword/20 border-card-sword/50"
                  description="대상 1명에게 1 데미지"
                />
                <CardInfo
                  icon={<Bomb className="w-5 h-5" />}
                  name="폭탄"
                  color="bg-card-bomb/20 border-card-bomb/50"
                  description="5분 후 대상에게 2 데미지"
                />
                <CardInfo
                  icon={<Beer className="w-5 h-5" />}
                  name="맥주"
                  color="bg-card-beer/20 border-card-beer/50"
                  description="자신 생명력 1 회복"
                />
              </div>
            </div>
          </Section>

          {/* 역할 */}
          <Section title="👥 역할">
            <div className="space-y-4">
              <RoleCategory
                title="악 팀 (마왕 / 배신자)"
                icon={<Skull className="w-4 h-4" />}
                color="text-evil"
              >
                <RoleItem
                  name="공포의 마왕"
                  description="능력: 공포의 재림(1회, 사망 시 생명력 3으로 부활하며 부활 시 정체 전체 공개), 겁주기(쿨타임 3분, 대상 1명 2분간 행동 불가)"
                />
                <RoleItem
                  name="분탕의 마왕"
                  description="능력: 분탕의 집념(1회, 사망 시에도 3분간 죽지 않고 생존), 가면놀이(1회, 게임 동안 돋보기 대상이 될 때 보일 역할을 지정)"
                />
                <RoleItem
                  name="참모"
                  description="능력: 악의 하수인(게임 시작 시 마왕 정체를 알고 시작), 레이드 정보(이번 게임에 어떤 용사 역할이 존재하는지, 모든 용사가 있다면 어떤 시민이 있는지도 알고 시작)"
                />
                <RoleItem
                  name="타락자"
                  description="능력: 악의 하수인(게임 시작 시 마왕 정체를 알고 시작), 술자리 권유(쿨타임 3분, 대상 1명 다음 카드 뽑기에서 확정적으로 맥주 획득)"
                />
              </RoleCategory>

              <RoleCategory
                title="선 팀 (용사)"
                icon={<Shield className="w-4 h-4" />}
                color="text-hero"
              >
                <RoleItem
                  name="패링맨"
                  description="능력: 무적방패(쿨타임 3분, 1분간 모든 피해 무효)"
                />
                <RoleItem
                  name="슬레이어"
                  description="능력: 짱쎈 필살기(1회 사용, 대상 1명에게 2 데미지, 사용 시 누가 누구를 공격했는지 전체 공개)"
                />
                <RoleItem
                  name="현자"
                  description="능력: 예언(돋보기를 뽑을 경우, 돋보기 한 장을 추가로 획득)"
                />
                <RoleItem
                  name="힐러"
                  description="능력: 회복 마법(쿨타임 3분, 대상 1명의 생명력 1 회복)"
                />
              </RoleCategory>

              <RoleCategory
                title="선 팀 (시민)"
                icon={<Crown className="w-4 h-4" />}
                color="text-citizen"
              >
                <RoleItem
                  name="약골"
                  description="능력: 만성 피로(생명력 2로 시작), 꾀병(생명력이 비정상적으로 표시되어 본인도 실제 생명력을 알 수 없음)"
                />
                <RoleItem
                  name="겁쟁이"
                  description="능력: 손떨림(카드 사용 시 50% 확률로 무효 처리)"
                />
                <RoleItem
                  name="정신병자"
                  description="능력: 망상(자신을 용사라고 인식해 UI 상 용사로 표기되지만, 실제로 능력은 발동되지 않음)"
                />
                <RoleItem
                  name="실험체"
                  description="능력: 저주의 숙주(사망 시 악 팀 전원이 카드 2장씩 획득)"
                />
              </RoleCategory>
            </div>
          </Section>
        </div>
      </ScrollArea>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="glass-card rounded-xl p-5 space-y-4 animate-fade-in">
      <h2 className="text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
}

function CardInfo({
  icon,
  name,
  color,
  description,
}: {
  icon: React.ReactNode;
  name: string;
  color: string;
  description: string;
}) {
  return (
    <div className={`p-3 rounded-lg border ${color}`}>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="font-semibold text-sm">{name}</span>
      </div>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

function RoleCategory({
  title,
  icon,
  color,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className={`flex items-center gap-2 mb-2 ${color}`}>
        {icon}
        <h4 className="font-bold">{title}</h4>
      </div>
      <div className="space-y-2 pl-4">{children}</div>
    </div>
  );
}

function RoleItem({ name, description }: { name: string; description: string }) {
  return (
    <div className="text-sm">
      <span className="font-medium">{name}</span>
      <span className="text-muted-foreground"> - {description}</span>
    </div>
  );
}

