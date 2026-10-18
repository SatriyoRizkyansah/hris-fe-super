import DanaOperasionalDetailClientPage from "./DanaOperasionalDetailClientPage";

export default function Page({ params }: { params: { id: string } }) {
  return <DanaOperasionalDetailClientPage id={params.id} />;
}
