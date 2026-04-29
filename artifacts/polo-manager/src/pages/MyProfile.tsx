import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useGetMyLinkedPlayer, useUpdateMyProfile, useListClubs, getGetMyLinkedPlayerQueryKey, type Player, type Club } from "@workspace/api-client-react";
import { SpectatorLayout } from "@/components/layout/SpectatorLayout";
import { PageLoading, EmptyState } from "@/components/LoadingBar";
import { ImageCropUpload } from "@/components/ImageCropUpload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";

export function MyProfile() {
  const { isAuthenticated } = useAuth();
  const { data: linkedRaw, isLoading, refetch } = useGetMyLinkedPlayer({ query: { enabled: isAuthenticated, queryKey: getGetMyLinkedPlayerQueryKey() } });
  const linked = linkedRaw as Player | null | undefined;
  const { data: clubsRaw } = useListClubs();
  const clubs = clubsRaw as Club[] | undefined;
  const update = useUpdateMyProfile();

  const [name, setName] = useState("");
  const [homeClubId, setHomeClubId] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [bio, setBio] = useState("");
  const [headshotUrl, setHeadshotUrl] = useState<string | null>(null);

  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  useEffect(() => {
    if (linked) {
      setName(linked.name);
      setHomeClubId(linked.homeClubId ?? "");
      setDateOfBirth(linked.dateOfBirth ?? "");
      setBio(linked.bio ?? "");
      setHeadshotUrl(linked.headshotUrl ?? null);
    }
  }, [linked]);

  if (!isAuthenticated) {
    return (
      <SpectatorLayout>
        <EmptyState
          title="Sign in required"
          description="Log in to manage your player profile."
        />
        <div className="mt-4 flex justify-center"><Link href="/login" className="text-g700 hover:underline">Go to login →</Link></div>
      </SpectatorLayout>
    );
  }

  if (isLoading) return <SpectatorLayout><PageLoading /></SpectatorLayout>;

  if (!linked) {
    return (
      <SpectatorLayout>
        <EmptyState
          title="No linked player profile"
          description="Your account isn't linked to a player profile yet. Ask a club administrator to link your account to your player record."
        />
      </SpectatorLayout>
    );
  }

  const handleSave = async () => {
    setSaveMsg(null);
    try {
      await update.mutateAsync({
        playerId: linked.id,
        data: {
          name: name.trim(),
          homeClubId: homeClubId || null,
          dateOfBirth: dateOfBirth || null,
          bio: bio || null,
          headshotUrl,
        },
      });
      setSaveMsg("Saved");
      refetch();
      setTimeout(() => setSaveMsg(null), 2000);
    } catch (e: any) {
      setSaveMsg(e?.response?.data?.message || e?.message || "Save failed");
    }
  };

  return (
    <SpectatorLayout>
      <div className="space-y-5">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">My Profile</h1>
          <p className="text-[14px] text-ink2 mt-1">Update your public player profile.</p>
        </div>

        <div className="bg-white rounded-[12px] p-5 card-shadow">
          <div className="flex items-start gap-5 mb-5">
            <div className="flex flex-col items-center gap-2">
              <ImageCropUpload value={headshotUrl} onChange={setHeadshotUrl} name={name || linked.name} size={96} />
              {headshotUrl && (
                <button className="text-[11px] text-red-600 hover:underline" onClick={() => setHeadshotUrl(null)}>Remove</button>
              )}
            </div>
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <Label>Home Club</Label>
                <select className="w-full border border-line rounded-[8px] px-3 py-2 text-[14px]" value={homeClubId} onChange={(e) => setHomeClubId(e.target.value)}>
                  <option value="">— None —</option>
                  {clubs?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <Label>Date of Birth</Label>
                <Input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <Label>Bio</Label>
                <Textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={handleSave} disabled={update.isPending}>{update.isPending ? "Saving…" : "Save"}</Button>
            {saveMsg && <span className="text-[13px] text-ink2">{saveMsg}</span>}
            <Link href={`/players/${linked.id}`} className="ml-auto text-g700 hover:underline text-[13px]">View public profile →</Link>
          </div>
        </div>
      </div>
    </SpectatorLayout>
  );
}
