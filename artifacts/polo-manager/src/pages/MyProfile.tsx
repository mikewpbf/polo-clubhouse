import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useGetMyLinkedPlayer, useUpdateMyProfile, useListClubs } from "@workspace/api-client-react";
import { SpectatorLayout } from "@/components/layout/SpectatorLayout";
import { PageLoading, EmptyState } from "@/components/LoadingBar";
import { PlayerHeadshot } from "@/components/PlayerHeadshot";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Upload } from "lucide-react";
import { uploadImageFile } from "@/lib/upload";
import { useAuth } from "@/hooks/use-auth";

export function MyProfile() {
  const { isAuthenticated } = useAuth();
  const { data: linked, isLoading, refetch } = useGetMyLinkedPlayer({ query: { enabled: isAuthenticated } as any });
  const { data: clubs } = useListClubs();
  const update = useUpdateMyProfile();

  const [name, setName] = useState("");
  const [homeClubId, setHomeClubId] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [bio, setBio] = useState("");
  const [headshotUrl, setHeadshotUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  useEffect(() => {
    if (linked) {
      setName(linked.name);
      setHomeClubId((linked as any).homeClubId ?? "");
      setDateOfBirth((linked as any).dateOfBirth ?? "");
      setBio((linked as any).bio ?? "");
      setHeadshotUrl((linked as any).headshotUrl ?? null);
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

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadImageFile(file);
      setHeadshotUrl(url);
    } catch (e: any) {
      alert(e?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaveMsg(null);
    try {
      await update.mutateAsync({
        playerId: (linked as any).id,
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
              <PlayerHeadshot url={headshotUrl} name={name || (linked as any).name} size={96} />
              <label className="text-[12px] text-g700 cursor-pointer hover:underline inline-flex items-center gap-1">
                <Upload className="w-3 h-3" />
                {uploading ? "Uploading…" : (headshotUrl ? "Change" : "Upload")}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUpload(f);
                }} />
              </label>
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
                  {(clubs as any[] | undefined)?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
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
            <Link href={`/players/${(linked as any).id}`} className="ml-auto text-g700 hover:underline text-[13px]">View public profile →</Link>
          </div>
        </div>
      </div>
    </SpectatorLayout>
  );
}
