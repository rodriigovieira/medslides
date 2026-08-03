import { SharedDeck } from "@/components/SharedDeck";

export default async function SharedDeckPage({
  params,
}: {
  params: Promise<{ deckId: string }>;
}) {
  const { deckId } = await params;
  return <SharedDeck deckId={deckId} />;
}
