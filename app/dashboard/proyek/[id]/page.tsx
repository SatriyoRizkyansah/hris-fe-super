import ProyekDetailClientPage from "./ProyekDetailClientPage";

export default function Page({ params }: { params: { id: string } }) {
  return <ProyekDetailClientPage id={params.id} />;
}
