## TODO Tasks

### 4. Create the Downloads page
Create a **Downloads** page that represents the current backend queue state.

#### Functional idea
- Downloads are queued backend-side.
- Only one download runs at a time.
- The queue continues even if the frontend is closed.
- The backend is not implemented yet, so the frontend must work with a mocked API contract.

#### Requirements
- Show queued, running, completed, failed, and cancelled download items.
- Show enough information per item to understand status and progress.
- Show which item is currently active.
- Make the UI clearly represent that processing is sequential, one item at a time.
- Do not implement backend logic now.
- Implement a frontend mock API layer so the page can be tested immediately.

#### Mock API contract to prepare
Define and use a mock contract for endpoints such as:
- get download queue
- get current active download
- enqueue a new download
- cancel a queued or active download
- retry a failed download
- remove a completed or cancelled download from visible history if needed

The exact route naming can be refined during implementation, but the contract must be explicit and easy to swap with the real backend later.

### 5. Create the Library page
Create a **Library** page showing all books already downloaded.

#### Functional idea
- Data comes from API.
- Backend is not implemented yet.
- Frontend must use a mocked API so the page can be tested immediately.

#### Requirements
- Show a collection of downloaded books using the same book card language where useful.
- The page should feel consistent with the Search experience, but adapted to already downloaded items.
- Include the core metadata needed to identify and reuse a downloaded book.
- The page must be driven by API data, even if mocked for now.
- Do not implement backend logic now.

#### Mock API contract to prepare
Define and use a mock contract for endpoints such as:
- get all downloaded books
- get details for one downloaded book
- reveal local output path if relevant
- optionally refresh library state

The contract must be written in a way that makes backend implementation straightforward later.

## Delivery expectations

### Refactor approach
- Perform the refactor incrementally.
- Keep the application working after each major step.
- Avoid a full rewrite unless absolutely necessary.
- Prefer simple modules over clever abstractions.

### UX expectations
- Preserve the current clean and utilitarian interface style.
- Improve clarity where the new navigation and pages require it.
- Keep interactions predictable and consistent.
- Reuse the existing design language for cards, states, and actions.

### Technical expectations
- Stay in vanilla JavaScript.
- Do not introduce a frontend framework.
- Do not introduce unnecessary tooling.
- Make mocked APIs easy to replace with real APIs later.
- Keep responsibilities clearly separated so future frontend extension is easier.

## Suggested implementation order
1. Refactor the frontend into the new modular structure.
2. Introduce the application shell with left sidebar navigation.
3. Move the existing Search experience into the new default home page.
4. Create the mocked Downloads page and queue contract.
5. Create the mocked Library page and downloaded-books contract.
6. Polish navigation state, loading states, empty states, and error states.

## Definition of done
- Frontend is modularized according to the new structure.
- `app.js` is reduced to bootstrap and wiring responsibilities.
- Sidebar navigation is present and working.
- Search is the default landing page.
- Downloads page exists and works against a mock API.
- Library page exists and works against a mock API.
- Current features still work after the refactor.
- The new structure is easier to extend for future frontend work.