import Link from "next/link";
import type { MovieDetail } from "@/lib/movie-data";
import { ChecksumRow } from "./ChecksumRow";

type Props = { movie: MovieDetail; canEdit: boolean };

function formatDateLL(isoDate: string | null): string {
  if (!isoDate) return "";
  const d = new Date(isoDate);
  return d.toLocaleDateString("de-DE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function MovieInfo({ movie, canEdit }: Props) {
  const accent = movie.accentColor ?? "#FFD700";

  return (
    <section className="movie-info">
      <div className="info-card">
        <h3>Details</h3>
        <ul>
          <li>
            <span>Titel</span>
            <strong>{movie.title}</strong>
          </li>
          <li>
            <span>Erscheinungsjahr</span>
            <strong>{movie.releaseYear}</strong>
          </li>
          {movie.collection && (
            <li>
              <span>Filmreihe</span>
              <strong>
                <Link
                  href={`/collections/${movie.collection.id}`}
                  className="hero-link"
                  style={{ ["--accent" as string]: movie.collection.accentColor ?? accent }}
                >
                  {movie.collection.name}
                </Link>
              </strong>
            </li>
          )}
          {movie.assignedToUser && canEdit && (
            <li>
              <span>Von wem</span>
              <strong>
                {movie.assignedToUser.name}
                <span
                  className={`role-badge role--${movie.assignedToUser.role.toLowerCase()}`}
                >
                  {movie.assignedToUser.role}
                </span>
              </strong>
            </li>
          )}
          {canEdit && (movie.additionalAssignees?.length ?? 0) > 0 && (
            <li>
              <span>Weitere zugewiesene</span>
              <div className="flex flex-wrap gap-2 mt-1">
                {movie.additionalAssignees!.map((a) => (
                  <span
                    key={a.user.id}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-sm bg-panel border border-ring"
                  >
                    {a.user.name}
                    <span className={`role-badge role--${a.user.role.toLowerCase()}`}>
                      {a.user.role}
                    </span>
                  </span>
                ))}
              </div>
            </li>
          )}
          {movie.ui.addedAt && (
            <li>
              <span>Hinzugefügt</span>
              <strong>{formatDateLL(movie.ui.addedAt)}</strong>
            </li>
          )}
        </ul>
      </div>

      <div className="info-card">
        <h3>
          {movie.ui.videobusterUrl ? (
            <Link
              href={movie.ui.videobusterUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hero-link"
              style={{ ["--accent" as string]: accent }}
            >
              Videobuster
            </Link>
          ) : (
            "Videobuster"
          )}
        </h3>
        <ul>
          {movie.ui.vbSentAt && (
            <li>
              <span>Ausgang</span>
              <strong>{formatDateLL(movie.ui.vbSentAt)}</strong>
            </li>
          )}
          {movie.ui.vbReceivedAt && (
            <li>
              <span>Eingang</span>
              <strong>{formatDateLL(movie.ui.vbReceivedAt)}</strong>
            </li>
          )}
          <li>
            <span>Status</span>
            <strong>
              {movie.status === "VO_SOON" && movie.ui.statusScheduledAt
                ? `VÖ: Demnächst (${formatDateLL(movie.ui.statusScheduledAt)})`
                : movie.ui.statusLabel}
            </strong>
          </li>
          <li>
            <span>Priorität</span>
            <strong>{movie.ui.priorityLabel}</strong>
          </li>
        </ul>
      </div>

      <div className="info-card">
        <h3>Encoding</h3>
        <ul>
          {movie.ui.sizeBefore && (
            <li>
              <span>Dateigröße vorher</span>
              <strong>{movie.ui.sizeBefore}</strong>
            </li>
          )}
          {movie.ui.sizeAfter && (
            <li>
              <span>Dateigröße nachher</span>
              <strong>{movie.ui.sizeAfter}</strong>
            </li>
          )}
          {movie.ui.savingsPct && (
            <li>
              <span>Ersparnis</span>
              <strong>{movie.ui.savingsPct}</strong>
            </li>
          )}
          {movie.ui.quality && (
            <li>
              <span>Qualität</span>
              <strong>{movie.ui.quality}</strong>
            </li>
          )}
          {movie.ui.checkSum ? (
            <ChecksumRow checkSum={movie.ui.checkSum} />
          ) : null}
          {movie.files.length > 0 && (
            <li>
              <span>Files</span>
              <div className="files-list">
                {movie.files.map((f, i) => (
                  <div key={i} className="file-pill">
                    <span>{f.resolution ?? "—"}</span>
                    <span>{f.codec ?? "—"}</span>
                    <span>{f.audio ?? "—"}</span>
                  </div>
                ))}
              </div>
            </li>
          )}
        </ul>
      </div>
    </section>
  );
}
