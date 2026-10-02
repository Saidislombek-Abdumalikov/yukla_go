import assert from 'assert';
import {
  extractYouTubeId,
  getCourseLessonsForUser,
  recordUserLessonProgress,
  resetStudentProgress,
  getStudentsProgressSummary,
  addLessonToCourse,
  deleteLesson,
  STORED_LESSONS,
} from '../api/_lib/academyData.ts';

async function runAcademyTests() {
  console.log('--- STARTING ACADEMY LMS ENGINE AUTOMATED AUDIT ---');

  // TEST 1: YouTube ID Extraction
  console.log('[TEST 1] YouTube Video ID Extractor');
  assert.strictEqual(extractYouTubeId('https://www.youtube.com/watch?v=M7lc1UVf-VE'), 'M7lc1UVf-VE');
  assert.strictEqual(extractYouTubeId('https://youtu.be/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.strictEqual(extractYouTubeId('https://www.youtube.com/embed/jNQXAC9IVRw'), 'jNQXAC9IVRw');
  assert.strictEqual(extractYouTubeId('https://www.youtube.com/watch?feature=shared&v=21X5lGlDOfg'), '21X5lGlDOfg');
  assert.strictEqual(extractYouTubeId('L_LUpnjgPso'), 'L_LUpnjgPso');
  console.log('  ✓ All YouTube URL formats correctly parsed into 11-char IDs');

  // TEST 2: Sequential Lesson Lock / Unlock Behavior
  console.log('[TEST 2] Sequential Lesson Lock / Unlock Flow');
  const testStudentId = 'usr_seq_test_' + Date.now();
  const courseId = 'course_cargo_101';

  // Initially:
  let initialLessons = getCourseLessonsForUser(testStudentId, courseId);
  assert.ok(initialLessons.length >= 3, 'Course should have at least 3 lessons');
  assert.strictEqual(initialLessons[0].isLocked, false, 'Lesson 1 must always be unlocked');
  assert.strictEqual(initialLessons[1].isLocked, true, 'Lesson 2 must be initially locked');
  assert.strictEqual(initialLessons[2].isLocked, true, 'Lesson 3 must be initially locked');
  console.log('  ✓ Initial state: Lesson 1 unlocked, Lesson 2 & 3 locked');

  // Complete Lesson 1 legitimately (e.g. verified or admin simulated completion)
  const firstLesson = initialLessons[0];
  const res1 = recordUserLessonProgress(testStudentId, firstLesson.id, firstLesson.durationSeconds, true, true);
  assert.strictEqual(res1.success, true);
  assert.strictEqual(res1.unlockedNextLesson, true, 'Completing lesson 1 must unlock next lesson');

  let updatedLessons = getCourseLessonsForUser(testStudentId, courseId);
  assert.strictEqual(updatedLessons[0].isCompleted, true, 'Lesson 1 marked completed');
  assert.strictEqual(updatedLessons[1].isLocked, false, 'Lesson 2 is now unlocked');
  assert.strictEqual(updatedLessons[2].isLocked, true, 'Lesson 3 remains locked until Lesson 2 is completed');
  console.log('  ✓ Sequential unlocking verified: Lesson 2 unlocked after Lesson 1 completed');

  // TEST 3: Anti-Cheat Jump Protection (Clamping Forward Seeking)
  console.log('[TEST 3] Server-Side Progress Jump Protection');
  const cheaterId = 'usr_cheater_' + Date.now();
  const cheatLesson = initialLessons[0];

  // Cheater tries to claim they watched 360 seconds on a brand new lesson in 0 elapsed seconds
  const cheatAttempt = recordUserLessonProgress(cheaterId, cheatLesson.id, 360, true);
  // Server should clamp to initial allowed window (max 15s) and NOT mark completed
  assert.strictEqual(cheatAttempt.progress.completed, false, 'Cheating attempt must NOT complete the lesson');
  assert.ok(cheatAttempt.progress.maxWatchedSeconds <= 25, 'Cheating jump must be clamped');
  assert.strictEqual(cheatAttempt.unlockedNextLesson, false, 'Next lesson must NOT unlock for skipped video');
  console.log('  ✓ Forward jump clamped: Skipped seconds rejected, completion denied');

  // TEST 4: Student Progress Reset (Admin Capability)
  console.log('[TEST 4] Admin Student Progress Reset');
  // Reset the first test student
  resetStudentProgress(testStudentId, courseId);
  const resetLessons = getCourseLessonsForUser(testStudentId, courseId);
  assert.strictEqual(resetLessons[0].isCompleted, false, 'Lesson 1 completed flag reset to false');
  assert.strictEqual(resetLessons[0].maxWatchedSeconds, 0, 'Watched seconds reset to 0');
  assert.strictEqual(resetLessons[1].isLocked, true, 'Lesson 2 re-locked after reset');
  console.log('  ✓ Reset student progress restored full sequential locks');

  // TEST 5: Student Progress Summary
  console.log('[TEST 5] Student Progress Summary Calculation');
  const demoStudents = [
    { id: testStudentId, name: 'Test User', customerCode: 'YK-999' },
  ];
  const summary = getStudentsProgressSummary(demoStudents, courseId);
  assert.strictEqual(summary.length, 1);
  assert.strictEqual(summary[0].customerCode, 'YK-999');
  assert.strictEqual(summary[0].completionPercentage, 0);
  console.log('  ✓ Student progress summary accurately computed');

  // TEST 6: Lesson CRUD Operations
  console.log('[TEST 6] Admin Lesson CRUD Operations');
  const initialCount = STORED_LESSONS.filter(l => l.courseId === courseId).length;
  const createdLesson = addLessonToCourse(courseId, {
    title: 'Audit Test Lesson',
    youtubeUrlOrId: 'https://youtu.be/M7lc1UVf-VE',
    durationSeconds: 450,
    description: 'Automated test lesson',
  });

  assert.ok(createdLesson.id.startsWith('les_'), 'Created lesson should have a valid ID');
  assert.strictEqual(createdLesson.youtubeVideoId, 'M7lc1UVf-VE', 'URL should be extracted to ID');
  assert.strictEqual(
    STORED_LESSONS.filter(l => l.courseId === courseId).length,
    initialCount + 1,
    'Lesson count must increment'
  );

  // Delete created lesson
  const deleted = deleteLesson(createdLesson.id);
  assert.strictEqual(deleted, true, 'deleteLesson should return true');
  assert.strictEqual(
    STORED_LESSONS.filter(l => l.courseId === courseId).length,
    initialCount,
    'Lesson count must revert after deletion'
  );
  console.log('  ✓ Admin add & delete lesson operations validated');

  console.log('--- ALL ACADEMY LMS ENGINE TESTS PASSED! ---');
}

runAcademyTests();
