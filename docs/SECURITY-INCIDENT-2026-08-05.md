# Member data exposure — discovered 5 August 2026

Written for parish leadership. It records what was exposed, what has been done,
what cannot be undone, and the two decisions that are leadership's to make
rather than the developer's.

## What happened

The church's source code is kept on GitHub. Between August 2025 and August 2026
that repository was **public** — readable by anyone on the internet, with no
password. Two files containing member records had been committed into it.

Removing a file from a Git repository does not remove it from the history. Both
files had been "removed" at the time, and both remained fully readable for the
whole period.

| File | People | Information | Readable from | Until |
|---|---|---|---|---|
| `church-members-list.csv` | 63 | name, phone, membership status, **baptism name, repentance father** | 2 Aug 2025 | 5 Aug 2026 |
| `members-info-2025-09-01.csv` | 302 | phone, first and last name, spouse name | 3 Sep 2025 | 5 Aug 2026 |

A third file containing a single line of bank-statement test data was also
present and has been removed.

**No passwords, keys, or banking credentials were exposed.** The one settings
file in the repository that could have held them contains only placeholders.
Member financial records — dues, pledges, giving — live in the database, not in
the code, and were not affected.

The most sensitive items are **baptism name** and **repentance father** in the
first file. Those are records of a person's spiritual life, and members would
reasonably expect them to be held more closely than a phone number.

## What has been done

1. **5 Aug 2026** — the repository was made private. Public access stopped
   immediately.
2. A complete backup of the repository was taken before any further change.
3. Both files were erased from the entire history of every branch, verified,
   and the corrected history published. (See "Status" below.)
4. An automatic check now blocks any future commit that contains member records
   or credentials, so this cannot recur by accident.

## What cannot be undone

Erasing the files stops anyone reading them *from now on*. It cannot recover
copies made while the repository was public. Public code repositories are
routinely copied and indexed by automated systems, so **the safe assumption is
that this data has been copied and cannot be recalled.**

There is no evidence that anyone did copy it. There is also no way to prove
nobody did — public repositories do not record who reads them.

## Two decisions for leadership

**1. Should the affected members be told?**

365 people are affected; 63 of them by the more sensitive file. Arguments run
both ways: the exposed information is largely a parish directory of the kind
many churches publish, and there is no evidence of misuse — but members did not
consent to publication, and the baptism name and repentance father fields are
of a different character to a phone number.

This is a question of pastoral duty and trust rather than a technical one, and
it should be decided with the priest.

**2. Does any legal notification duty apply?**

Texas has breach-notification requirements (Business & Commerce Code
§ 521.053). Whether they are triggered depends on the categories of data
involved; name and telephone number alone often do not meet the statutory
definition, which generally turns on identifiers such as Social Security,
financial account, or medical information — none of which were exposed.

**This should be confirmed by someone qualified rather than assumed.** It is
noted here so the question is asked, not answered.

## Recommended follow-up

- Decide the two questions above with the priest and board, and record the
  decision.
- Keep the repository private. It holds a live membership system for a real
  congregation; there is no benefit to the parish in it being public.
- Do not place member exports in the project folder, even briefly. Anything
  needed for a one-off task belongs outside it.

## One step still outstanding on GitHub

The corrected history has been published, and anyone cloning the repository now
gets a copy with no trace of these files. Verified against a fresh download.

However, **GitHub still holds the old copies on its servers.** This is normal:
GitHub keeps detached data for a period before clearing it, and during that time
it can still be retrieved by anyone who knows its exact reference. This was
confirmed rather than assumed — the old file was successfully retrieved from
GitHub after the correction was published.

Two things limit this. The repository is private, so only people the church has
granted access can retrieve it. And there are no forks — nobody holds an
independent copy on GitHub.

To finish the job, GitHub Support must be asked to clear the detached data:

> Open a ticket at https://support.github.com/ for `dawityifter/abune-aregawi`,
> asking them to **garbage-collect unreachable objects and purge cached views**
> after a history rewrite that removed sensitive data. Reference the removed
> paths `church-members-list.csv` and `members-info-2025-09-01.csv`.

Until they confirm, treat the data as still retrievable by anyone with repository
access.

## Status

- [x] Repository made private
- [x] Full backup taken and verified
- [x] Files erased from all history and verified absent
- [x] Corrected history published to GitHub (verified from a fresh clone)
- [x] Automatic check added to block future commits of member data
- [ ] **GitHub Support asked to purge detached copies** ← next action
- [ ] Notification decision made with the priest
- [ ] Legal question confirmed
