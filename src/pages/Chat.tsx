import { useState, type CSSProperties } from 'react'
import { Link } from 'react-router'
import PostBoard from './PostBoard.tsx'
import SessionButton from './SessionButton.tsx'
import { usePageTitle } from '../lib/usePageTitle.ts'
import { useAuth } from '../lib/auth.ts'
import { authorName, useProfile } from '../lib/profile.ts'
import { MAP_SHAPES } from '../estados/mapShapes.ts'
import board from './Comunidad.module.css'
import styles from './Chat.module.css'

/** The chat of one Bundesland. It is the community board's list and form
    (PostBoard.tsx) asking for one state's messages, and it looks for new
    ones by itself every 20 seconds.
    - Paid member with a state: their state's chat.
    - Paid member without a state: "Elige tu estado".
    - Free member: the same message as on the board, and no request.
    - Admin: a list to pick any state; reads and posts in the chosen one.
    The database (RLS) decides in the end what each person reads and posts. */
export default function Chat() {
  const { session } = useAuth()
  const { profile } = useProfile()
  const userId = session?.user.id ?? null
  const isAdmin = profile?.is_admin === true
  const canRead = profile?.plan === 'paid' || isAdmin

  // Admins only: the state picked in the list (starts on their own, if any)
  const [picked, setPicked] = useState(() => profile?.main_state ?? '')
  const stateId = (isAdmin ? picked : profile?.main_state) || null
  /* German name of the state, '' when there is none */
  const name = MAP_SHAPES.find((s) => s.id === stateId)?.name ?? ''
  usePageTitle((name ? 'Chat de ' + name : 'Chat') + ' · Medical Network')


  /* The title's size comes from its longest word ("Mecklenburg-" counts
     12, "Niedersachsen." 14), as on Novedades. Set from code (React's style
     prop), never as a style="..." attribute: the site's CSP blocks those. */
  const titleWord = name ? name + '.' : 'chat.'
  const titleParts = titleWord.split('-')
  const titleChars = Math.max(...titleParts.map((w, i) => w.length + (i < titleParts.length - 1 ? 1 : 0)))
  const titleStyle = { '--title-chars': titleChars } as CSSProperties

  return (
    <div className={board.page}>
      <header className={board.header}>
        <Link className={board.pill} to="/novedades">
          <span aria-hidden="true">←</span> Novedades
        </Link>
        <SessionButton />
      </header>

      <main className={board.main}>
        <div className={board.head}>
          {/* Read as one heading: "Chat de Bayern" / "Chat" */}
          {name ? (
            <h1 className={board.pageTitle + ' ' + styles.title} style={titleStyle}>
              <span className={board.label}>Chat de</span>{' '}
              <span className={styles.titleName} lang="de">{name}<span aria-hidden="true">.</span></span>
            </h1>
          ) : (
            <>
              <p className={board.label}>tu</p>
              <h1 className={board.pageTitle} style={titleStyle}>
                Chat<span aria-hidden="true">.</span>
              </h1>
            </>
          )}
        </div>

        {!canRead || !userId || !profile ? (
          <p className={board.message}>La comunidad es para miembros con el paquete completo.</p>
        ) : (
          <div className={board.board}>
            {isAdmin && (
              <div className={styles.picker}>
                <label className={styles.pickerLabel} htmlFor="chat-state">Estado</label>
                <select
                  id="chat-state" className={styles.select}
                  value={picked} onChange={(e) => setPicked(e.target.value)}
                >
                  <option value="">Elige un estado</option>
                  {MAP_SHAPES.map((s) => (
                    <option key={s.id} value={s.id} lang="de">{s.name}</option>
                  ))}
                </select>
              </div>
            )}

            {stateId ? (
              <PostBoard
                key={userId + ':' + stateId}
                userId={userId}
                isAdmin={isAdmin}
                shownName={authorName(profile.first_name ?? '', profile.last_names ?? '')}
                state={stateId}
              />
            ) : isAdmin ? (
              <p className={board.message}>Elige un estado para ver su chat.</p>
            ) : (
              <div className={board.message + ' ' + board.isInverted + ' ' + styles.choose}>
                <p>Elige tu estado para entrar en su chat.</p>
                <Link className={styles.chooseLink} to="/estados">Elegir mi estado</Link>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
