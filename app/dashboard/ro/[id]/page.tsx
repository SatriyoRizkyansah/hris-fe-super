import RoDetailClientPage from "./RoDetailClientPage";

export default function Page({ params }: { params: { id: string } }) {
  return <RoDetailClientPage id={params.id} />;
}
