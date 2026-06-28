from secrets import token_urlsafe

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session

from app.db import get_session
from app.models import Team, TeamInvite, TeamMember, User
from app.routers.auth import get_current_user
from app.schemas import InviteRead, TeamCreate, TeamRead


router = APIRouter(prefix="/api/teams", tags=["teams"])


@router.post("", response_model=TeamRead, status_code=status.HTTP_201_CREATED)
def create_team(
    payload: TeamCreate,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> Team:
    team = Team(name=payload.name, owner_id=user.id)
    session.add(team)
    session.commit()
    session.refresh(team)
    session.add(TeamMember(team_id=team.id, user_id=user.id, role="owner"))
    session.commit()
    return team


@router.post("/{team_id}/invites", response_model=InviteRead, status_code=status.HTTP_201_CREATED)
def create_invite(
    team_id: int,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> TeamInvite:
    team = session.get(Team, team_id)
    if team is None or team.owner_id != user.id:
        raise HTTPException(status_code=404, detail="Team not found")
    invite = TeamInvite(team_id=team_id, created_by_id=user.id, invite_code=token_urlsafe(8))
    session.add(invite)
    session.commit()
    session.refresh(invite)
    return invite
